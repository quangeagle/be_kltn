const axios = require('axios');
const moment = require('moment');
const WeeklySalesInput = require('../models/WeeklySalesInput');
const PredictionLog = require('../models/PredictionLog');

// Hàm delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm retry với exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Nếu là lỗi 429, đợi lâu hơn
      if (error.response && error.response.status === 429) {
        const waitTime = baseDelay * Math.pow(2, i) + Math.random() * 1000;
        console.log(`⚠️ Rate limited (429), đợi ${waitTime}ms trước khi retry...`);
        await delay(waitTime);
      } else {
        // Lỗi khác, đợi ít hơn
        const waitTime = baseDelay * Math.pow(2, i);
        console.log(`⚠️ Lỗi ${error.response?.status || 'unknown'}, đợi ${waitTime}ms trước khi retry...`);
        await delay(waitTime);
      }
    }
  }
};

exports.predictNextWeekRevenue = async (supplierId, externalFactorsCurrentFromInput) => {
  console.log('🚀 Bắt đầu predictNextWeekRevenue cho supplier:', supplierId);
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  try {
    // Lấy record từ DB
    const record = await WeeklySalesInput.findOne({ supplier: supplierId });
    if (!record || !record.items || record.items.length === 0) {
      throw new Error('Không có dữ liệu tuần nào');
    }

    console.log('📊 Tổng số items trong DB:', record.items.length);
    
    // Sắp xếp items theo weekStart để lấy tuần gần nhất
    const sortedItems = record.items.slice().sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));
    const lastWeek = sortedItems[sortedItems.length - 1];
    
    console.log('📅 Tuần gần nhất:', lastWeek.weekStart);
    console.log('🔍 WeekIndex có trong DB:', sortedItems.map(item => item.weekIndex).sort((a, b) => a - b));

    // Tạo sales history với 10 tuần, fill 0 cho các tuần thiếu
    let salesHistory = [];
    
    if (sortedItems.length >= 10) {
      // Nếu có đủ 10 tuần, lấy 10 tuần gần nhất
      const last10Weeks = sortedItems.slice(-10);
      salesHistory = last10Weeks.map(item => item.weeklySales);
      console.log('✅ Có đủ 10 tuần, lấy 10 tuần gần nhất');
    } else {
      // Nếu không đủ 10 tuần, fill 0 cho các tuần thiếu
      const availableWeeks = sortedItems.length;
      const missingWeeks = 10 - availableWeeks;
      
      // Lấy tất cả tuần có sẵn
      const availableSales = sortedItems.map(item => item.weeklySales);
      
      // Fill 0 cho các tuần thiếu ở đầu
      salesHistory = Array(missingWeeks).fill(0).concat(availableSales);
      
      console.log(`⚠️ Chỉ có ${availableWeeks} tuần, fill ${missingWeeks} tuần đầu bằng 0`);
    }
    
    console.log('💰 Sales history (10 tuần):', salesHistory);
    console.log('📊 Số tuần thực tế:', sortedItems.length);
    console.log('📊 Số tuần được fill 0:', 10 - sortedItems.length);

    // externalFactorsPrevious lấy từ tuần cuối cùng có sẵn
    const externalFactorsPrevious = {
      Temperature: lastWeek.temperature || 0,
      Fuel_Price: lastWeek.fuelPrice || 0,
      CPI: lastWeek.cpi || 0,
      Unemployment: lastWeek.unemployment || 0
    };

    // Tính tuần dự đoán (tuần tiếp theo sau tuần cuối cùng)
    const weekToPredictMoment = moment(lastWeek.weekStart).add(1, 'weeks').startOf('isoWeek');
    const weekToPredictStart = weekToPredictMoment.toDate();

    // Lấy externalFactorsCurrent từ tham số hoặc từ tuần cuối cùng
    let externalFactorsCurrent = externalFactorsCurrentFromInput || {};
    if (Object.keys(externalFactorsCurrent).length === 0) {
      // Nếu không có external factors từ input, lấy từ tuần cuối cùng
      externalFactorsCurrent = {
        holidayFlag: lastWeek.holidayFlag || 0,
        temperature: lastWeek.temperature || 0,
        fuelPrice: lastWeek.fuelPrice || 0,
        cpi: lastWeek.cpi || 0,
        unemployment: lastWeek.unemployment || 0,
        month: weekToPredictMoment.month() + 1,
        weekOfYear: weekToPredictMoment.isoWeek(),
        year: weekToPredictMoment.isoWeekYear(),
        dayOfWeek: weekToPredictMoment.isoWeekday(),
        isWeekend: [6, 7].includes(weekToPredictMoment.isoWeekday()) ? 1 : 0
      };
    }

    console.log('📅 Tuần dự đoán:', weekToPredictStart);
    console.log('📊 External Factors Previous:', externalFactorsPrevious);
    console.log('📊 External Factors Current:', externalFactorsCurrent);

    // Gọi API dự đoán với retry logic và delay
    console.log('📡 Gọi API GRU Standalone...');
    const gruRes = await retryWithBackoff(async () => {
      return axios.post('https://deploy-modelai-1.onrender.com/gru-standalone', {
        sales_history: salesHistory
      });
    });
    console.log('✅ GRU API response:', gruRes.data);

    // Đợi 1 giây trước khi gọi API thứ 2 để tránh rate limiting
    console.log('⏳ Đợi 1 giây trước khi gọi API thứ 2...');
    await delay(1000);

    console.log('📡 Gọi API GRU Ensemble...');
    let xgbRes = null;
    try {
      xgbRes = await retryWithBackoff(async () => {
        return axios.post('https://deploy-modelai-1.onrender.com/gru-ensemble', {
          sales_history: salesHistory,
          external_factors_current: externalFactorsCurrent,
          external_factors_previous: externalFactorsPrevious
        });
      });
      console.log('✅ XGB API response:', xgbRes.data);
    } catch (xgbError) {
      console.error('❌ XGB API error:', xgbError.message);
      xgbRes = { data: { prediction: { final_prediction: null, confidence_score: null }, xgboost_explanation: null } };
    }

    console.log('📊 Preparing to return predictions:');
    console.log('- GRU prediction:', gruRes.data.predicted_sales);
    console.log('- XGB prediction:', xgbRes?.data?.prediction?.final_prediction);

    return {
      gruStandalonePrediction: gruRes.data.predicted_sales,
      gruEnsemblePrediction: xgbRes?.data?.prediction?.final_prediction || null,
      confidenceScoreStandalone: gruRes.data.confidence_score,
      confidenceScoreEnsemble: xgbRes?.data?.prediction?.confidence_score || null,
      // Thêm thông tin chi tiết như predic2
      gruDetails: {
        predictedSales: gruRes.data.predicted_sales,
        confidenceScore: gruRes.data.confidence_score || null,
        trend: gruRes.data.trend_detected || null,
        logs: {
          inputSequence: gruRes.data.input_sequence || null,
          message: gruRes.data.message || null,
          wasAdjusted: gruRes.data.was_adjusted || null,
          rawPrediction: gruRes.data.raw_prediction || null,
          adjustedPrediction: gruRes.data.adjusted_prediction || null
        }
      },
      xgbDetails: {
        predictedSales: xgbRes?.data?.prediction?.final_prediction || null,
        confidenceScore: xgbRes?.data?.prediction?.confidence_score || null,
        trend: xgbRes?.data?.prediction?.ensemble_breakdown?.adjustment_percentage ? 
          `${xgbRes.data.prediction.ensemble_breakdown.adjustment_percentage > 0 ? 'increasing' : 'decreasing'}` : null,
        logs: {
          message: xgbRes?.data?.prediction?.message || null,
          method: xgbRes?.data?.prediction?.method || null,
          modelType: xgbRes?.data?.prediction?.model_type || null,
          ensembleBreakdown: xgbRes?.data?.prediction?.ensemble_breakdown || null,
          gruContribution: xgbRes?.data?.prediction?.gru_prediction || null,
          xgboostAdjustment: xgbRes?.data?.prediction?.xgboost_adjustment_value || null,
          adjustmentRatio: xgbRes?.data?.prediction?.xgboost_adjustment_ratio || null
        },
        featureImportance: xgbRes?.data?.xgboost_explanation || null
      },
      metadata: {
        weekToPredict: weekToPredictStart,
        actualWeeksAvailable: sortedItems.length,
        weeksFilledWithZero: 10 - sortedItems.length,
        salesHistory: salesHistory,
        externalFactorsCurrent: externalFactorsCurrent,
        externalFactorsPrevious: externalFactorsPrevious
      }
    };
  } catch (err) {
    console.error('❌ Dự đoán lỗi:', err.message);
    if (err.response) {
      console.error('📊 Response status:', err.response.status);
      console.error('📊 Response data:', err.response.data);
    }
    throw err;
  }
};
