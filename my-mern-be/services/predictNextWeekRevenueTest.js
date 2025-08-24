const axios = require('axios');
const WeeklySalesTestInput = require('../models/WeeklySalesTestInput');
const PredictionTestLog = require('../models/PredictionTestLog');

// Hàm delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm retry với exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      if (error.response && error.response.status === 429) {
        const waitTime = baseDelay * Math.pow(2, i) + Math.random() * 1000;
        console.log(`⚠️ Rate limited (429), đợi ${waitTime}ms trước khi retry...`);
        await delay(waitTime);
      } else {
        const waitTime = baseDelay * Math.pow(2, i);
        console.log(`⚠️ Lỗi ${error.response?.status || 'unknown'}, đợi ${waitTime}ms trước khi retry...`);
        await delay(waitTime);
      }
    }
  }
};

exports.predictNextWeekRevenueTest = async () => {
  console.log('🚀 Bắt đầu predictNextWeekRevenueTest');
  try {
    // Lấy record test mới nhất
    const record = await WeeklySalesTestInput.findOne().sort({ createdAt: -1 });
    if (!record || !record.items || record.items.length === 0) {
      throw new Error('Không có dữ liệu test dataset');
    }

    console.log('📊 Tổng số items:', record.items.length);

    // Lọc 10 tuần gần nhất theo weekIndex
    const lastItems = record.items
      .filter(item => item.weekIndex >= 0 && item.weekIndex <= 9)
      .sort((a, b) => a.weekIndex - b.weekIndex);

    if (lastItems.length !== 10) {
      throw new Error(`Không đủ 10 tuần test (weekIndex 0-9), hiện có ${lastItems.length}`);
    }

    const salesHistory = lastItems.map(item => item.weeklySales);
    const lastWeek = lastItems[lastItems.length - 1];

    // externalFactorsPrevious = tuần cuối cùng
    const externalFactorsPrevious = {
      Temperature: lastWeek.temperature,
      Fuel_Price: lastWeek.fuelPrice,
      CPI: lastWeek.cpi,
      Unemployment: lastWeek.unemployment
    };

    // externalFactorsCurrent = tuần dự đoán (tuần tiếp theo)
    const externalFactorsCurrent = {
      holidayFlag: lastWeek.holidayFlag,
      temperature: lastWeek.temperature,
      fuelPrice: lastWeek.fuelPrice,
      cpi: lastWeek.cpi,
      unemployment: lastWeek.unemployment,
      month: lastWeek.month,
      weekOfYear: lastWeek.weekOfYear + 1, // tuần tiếp theo
      year: lastWeek.year,
      dayOfWeek: 1, // giả định thứ 2
      isWeekend: 0
    };

    // Thời gian tuần dự đoán (weekStart tiếp theo)
    const weekToPredictStart = new Date(lastWeek.weekStart);
    weekToPredictStart.setDate(weekToPredictStart.getDate() + 7);

    // ==== GỌI API ====
    console.log('📡 Gọi API GRU Standalone...');
    const gruStandaloneRes = await retryWithBackoff(async () => {
      return axios.post('https://deploy-modelai-1.onrender.com/gru-standalone', {
        sales_history: salesHistory
      });
    });

    console.log('⏳ Delay 1s trước khi gọi API thứ 2...');
    await delay(1000);

    console.log('📡 Gọi API GRU Ensemble...');
    const gruEnsembleRes = await retryWithBackoff(async () => {
      return axios.post('https://deploy-modelai-1.onrender.com/gru-ensemble', {
        sales_history: salesHistory,
        external_factors_current: externalFactorsCurrent,
        external_factors_previous: externalFactorsPrevious
      });
    });

    // ==== LƯU VÀO DB ====
    const doc = new PredictionTestLog({
      weekStart: weekToPredictStart,
      weekOfYear: externalFactorsCurrent.weekOfYear,
      year: externalFactorsCurrent.year,

      predictedByGRU: gruStandaloneRes.data.predicted_sales,
      predictedByXGB: gruEnsembleRes.data.final_prediction,

      actualWeeklySales: 0, // vì đang test, chưa có thực tế

      predictions: [
        {
          modelUsed: 'GRU',
          predictedSales: gruStandaloneRes.data.predicted_sales,
          confidenceScore: gruStandaloneRes.data.confidence_score || null,
          trend: gruStandaloneRes.data.trend_detected || null,
          logs: gruStandaloneRes.data,
          featureImportance: null
        },
        {
          modelUsed: 'XGB',
          predictedSales: gruEnsembleRes.data.final_prediction,
          confidenceScore: gruEnsembleRes.data.confidence_score || null,
          trend: null,
          logs: gruEnsembleRes.data,
          featureImportance: gruEnsembleRes.data.shap_analysis || null
        }
      ],

      externalFactorsCurrent
    });

    await doc.save();
    console.log('✅ Đã lưu kết quả dự đoán test vào PredictionTestLog');

    return doc;
  } catch (err) {
    console.error('❌ Lỗi predictNextWeekRevenueTest:', err.message);
    throw err;
  }
};
