const moment = require('moment');
const axios = require('axios');
const PredictionTestLog = require('../models/PredictionTestLog');
const WeeklySalesTestInput = require('../models/WeeklySalesTestInput');

// Helper delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm retry với exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const waitTime = baseDelay * Math.pow(2, i) + Math.random() * 1000;
      console.log(`⚠️ Retry ${i+1}/${maxRetries}, wait ${waitTime}ms`);
      await delay(waitTime);
    }
  }
};


// Controller chạy dự đoán test
exports.handlePredictionTest = async (req, res) => {
  try {
    const testRecord = await WeeklySalesTestInput.findOne({});
    if (!testRecord || !testRecord.items || testRecord.items.length === 0) {
      return res.status(400).json({ error: 'Không có dữ liệu test input' });
    }

    const sortedItems = testRecord.items.slice().sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));
    const lastWeek = sortedItems[sortedItems.length - 1];
    const weekToPredictMoment = moment(lastWeek.weekStart).add(1, 'weeks').startOf('isoWeek');
    const weekStart = weekToPredictMoment.toDate();

    const last10Weeks = sortedItems.slice(-10);
    const salesHistory = last10Weeks.map(item => item.weeklySales);

    const externalFactorsPrevious = {
      Temperature: lastWeek.temperature,
      Fuel_Price: lastWeek.fuelPrice,
      CPI: lastWeek.cpi,
      Unemployment: lastWeek.unemployment
    };

    const externalFactorsCurrent = {
      holidayFlag: lastWeek.holidayFlag,
      temperature: lastWeek.temperature,
      fuelPrice: lastWeek.fuelPrice,
      cpi: lastWeek.cpi,
      unemployment: lastWeek.unemployment,
      month: weekToPredictMoment.month() + 1,
      weekOfYear: weekToPredictMoment.isoWeek(),
      year: weekToPredictMoment.isoWeekYear(),
      dayOfWeek: weekToPredictMoment.isoWeekday(),
      isWeekend: [6, 7].includes(weekToPredictMoment.isoWeekday()) ? 1 : 0
    };

    const gruRes = await retryWithBackoff(() =>
      axios.post('https://deploy-modelai-1.onrender.com/gru-standalone', {
        sales_history: salesHistory
      })
    );
    console.log('✅ GRU API response:', gruRes.data);

    await delay(1000);

    let xgbRes = null;
    try {
      xgbRes = await retryWithBackoff(() =>
        axios.post('https://deploy-modelai-1.onrender.com/gru-ensemble', {
          sales_history: salesHistory,
          external_factors_current: externalFactorsCurrent,
          external_factors_previous: externalFactorsPrevious
        })
      );
      console.log('✅ XGB API response:', xgbRes.data);
    } catch (xgbError) {
      console.error('❌ XGB API error:', xgbError.message);
      xgbRes = { data: { prediction: { final_prediction: null, confidence_score: null }, xgboost_explanation: null } };
    }

    console.log('📊 Preparing to save log with:');
    console.log('- GRU prediction:', gruRes.data.predicted_sales);
    console.log('- XGB prediction:', xgbRes?.data?.prediction?.final_prediction);
    console.log('- Week to predict:', weekStart);
    
    const log = await PredictionTestLog.findOneAndUpdate(
      { weekStart },
      {
        weekStart,
        weekOfYear: weekToPredictMoment.isoWeek(),
        year: weekToPredictMoment.isoWeekYear(),
        predictedByXGB: xgbRes?.data?.prediction?.final_prediction || null,
        predictedByGRU: gruRes.data.predicted_sales,
        externalFactorsCurrent,
        predictions: [
          {
            modelUsed: 'GRU',
            predictedSales: gruRes.data.predicted_sales,
            confidenceScore: gruRes.data.confidence_score || null,
            trend: gruRes.data.trend_detected || null,
            logs: {
              inputSequence: gruRes.data.input_sequence || null,
              message: gruRes.data.message || null,
              wasAdjusted: gruRes.data.was_adjusted || null,
              rawPrediction: gruRes.data.raw_prediction || null,
              adjustedPrediction: gruRes.data.adjusted_prediction || null
            },
            featureImportance: null
          },
          {
            modelUsed: 'XGB',
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
          }
        ]
      },
      { upsert: true, new: true }
    );

    return res.json(log);  // ✅ trả kết quả cho client
  } catch (err) {
    console.error('❌ Lỗi handlePredictionTest:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Cập nhật actual sales cho test
exports.updateActualSalesTest = async (req, res) => {
  try {
    const { weekStartDate, actualWeeklySales } = req.body;
    if (!weekStartDate || actualWeeklySales === undefined) {
      return res.status(400).json({ error: 'weekStartDate và actualWeeklySales là bắt buộc' });
    }

    const weekStart = moment(weekStartDate).startOf('isoWeek').toDate();
    const log = await PredictionTestLog.findOne({ weekStart });

    if (!log) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi test prediction tuần này' });
    }

    log.actualWeeklySales = actualWeeklySales;
    await log.save();

    return res.json({ message: 'Cập nhật actual sales test thành công', data: log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật actual sales test' });
  }
};

// Helper tính accuracy
function calcAccuracy(actual, predicted) {
  if (actual === 0) return null;
  return 100 * (1 - Math.abs(actual - predicted) / actual);
}

// Lấy danh sách prediction test logs (phân trang, filter theo năm/tuần)
exports.getPredictionTestLogs = async (req, res) => {
  try {
    const { year, weekOfYear, page = 1, limit = 20 } = req.query;

    let filter = {};
    if (year) filter.year = parseInt(year);
    if (weekOfYear) filter.weekOfYear = parseInt(weekOfYear);

    const skip = (page - 1) * limit;

    const logs = await PredictionTestLog.find(filter)
      .sort({ year: 1, weekOfYear: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const data = logs.map(item => ({
      weekStart: item.weekStart,
      weekOfYear: item.weekOfYear,
      year: item.year,
      actualWeeklySales: item.actualWeeklySales,
      predictedByGRU: item.predictedByGRU,
      predictedByXGB: item.predictedByXGB,
      accuracyGRU: calcAccuracy(item.actualWeeklySales, item.predictedByGRU),
      accuracyXGB: calcAccuracy(item.actualWeeklySales, item.predictedByXGB),
      gruDetails: item.predictions?.find(p => p.modelUsed === 'GRU') || null,
      xgbDetails: item.predictions?.find(p => p.modelUsed === 'XGB') || null,
      summary: {
        gruTrend: item.predictions?.find(p => p.modelUsed === 'GRU')?.trend || null,
        xgbTrend: item.predictions?.find(p => p.modelUsed === 'XGB')?.trend || null,
        adjustmentPercentage: item.predictions?.find(p => p.modelUsed === 'XGB')?.logs?.ensembleBreakdown?.adjustment_percentage || null
      }
    }));

    return res.json({
      page: parseInt(page),
      limit: parseInt(limit),
      data
    });
  } catch (err) {
    console.error('Error fetching prediction test logs:', err);
    res.status(500).json({ error: 'Server error khi lấy prediction test logs' });
  }
};
