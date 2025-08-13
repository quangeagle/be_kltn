const axios = require('axios');
const WeeklySalesInput = require('../models/WeeklySalesInput');
const PredictionLog = require('../models/PredictionLog');

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
console.log('🔍 WeekIndex có trong DB:', record.items.map(item => item.weekIndex).sort((a, b) => a - b));

// Lọc items chỉ lấy weekIndex từ 0 đến 9 (đảm bảo đúng 10 tuần)
const lastItems = record.items
  .filter(item => item.weekIndex >= 0 && item.weekIndex <= 9)
  .sort((a, b) => a.weekIndex - b.weekIndex);
  if (lastItems.length !== 10) {
    throw new Error(`Không đủ 10 tuần (weekIndex 0-9), hiện có ${lastItems.length} tuần`);
  }
console.log('✅ Đã lọc được 10 tuần theo weekIndex 0-9');
console.log('📅 WeekIndex sau khi lọc:', lastItems.map(item => item.weekIndex));
console.log('Last 10 weeks data:', lastItems);

// Lấy sales history theo đúng thứ tự weekIndex
const salesHistory = lastItems.map(item => item.weeklySales);

console.log('💰 Sales history:', salesHistory);

    // externalFactorsPrevious lấy từ tuần cuối cùng trong lastItems
    const lastWeek = lastItems[lastItems.length - 1];
    const externalFactorsPrevious = {
      Temperature: lastWeek.temperature,
      Fuel_Price: lastWeek.fuelPrice,
      CPI: lastWeek.cpi,
      Unemployment: lastWeek.unemployment
    };

    // Lấy PredictionLog mới nhất theo supplier, giả sử tuần dự đoán bạn muốn lấy là record mới nhất
    const predictionLog = await PredictionLog.findOne({ supplier: supplierId }).sort({ weekStart: 1 });
    if (!predictionLog) {
      throw new Error('Không tìm thấy dữ liệu PredictionLog nào để lấy external factors');
    }

    const weekToPredictStart = predictionLog.weekStart;

    // Lấy externalFactorsCurrent từ predictionLog hoặc tham số truyền vào
    let externalFactorsCurrent = externalFactorsCurrentFromInput || {};
    if (predictionLog.externalFactorsCurrent) {
      externalFactorsCurrent = {
        holidayFlag: predictionLog.externalFactorsCurrent.holidayFlag,
        temperature: predictionLog.externalFactorsCurrent.temperature,
        fuelPrice: predictionLog.externalFactorsCurrent.fuelPrice,
        cpi: predictionLog.externalFactorsCurrent.cpi,
        unemployment: predictionLog.externalFactorsCurrent.unemployment
      };
    }

    console.log('Tuần dự đoán (weekToPredictStart):', weekToPredictStart);
    console.log('External Factors Previous:', externalFactorsPrevious);
    console.log('External Factors Current:', externalFactorsCurrent);

    // Gọi API dự đoán
    const [gruStandaloneRes, gruEnsembleRes] = await Promise.all([
      axios.post('https://deploy-modelai-1.onrender.com/gru-standalone', {
        sales_history: salesHistory
      }),
      axios.post('https://deploy-modelai-1.onrender.com/gru-ensemble', {
        sales_history: salesHistory,
        external_factors_current: externalFactorsCurrent,
        external_factors_previous: externalFactorsPrevious
      })
    ]);

    return {
      gruStandalonePrediction: gruStandaloneRes.data.predicted_sales,
      gruEnsemblePrediction: gruEnsembleRes.data.final_prediction,
      confidenceScoreStandalone: gruStandaloneRes.data.confidence_score,
      confidenceScoreEnsemble: gruEnsembleRes.data.confidence_score
    };
  } catch (err) {
    console.error('❌ Dự đoán lỗi:', err.message);
    throw err;
  }
};
