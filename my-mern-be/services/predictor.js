const axios = require('axios');
const WeeklySalesInput = require('../models/WeeklySalesInput');

exports.predictNextWeekRevenue = async (supplierId) => {
  try {
    const records = await WeeklySalesInput.find({ supplier: supplierId })
      .sort({ weekIndex: -1 })
      .limit(10);

    if (records.length === 0) {
      throw new Error('Không có dữ liệu đủ 10 tuần');
    }

    const sorted = records.sort((a, b) => a.weekIndex - b.weekIndex);

    const features = sorted.flatMap(item => [
      item.weeklySales || 0,
      item.holidayFlag || 0,
      item.temperature || 0,
      item.fuelPrice || 0,
      item.cpi || 0,
      item.unemployment || 0,
      item.weekOfYear || 0,
      item.month || 0
    ]);

    while (features.length < 80) features.unshift(0);

    const aiResponse = await axios.post('https://deploy-modelai.onrender.com/predict', { features });
    const predictedSales = aiResponse.data.predicted_weekly_sales;

    return predictedSales;
  } catch (err) {
    console.error('❌ Dự đoán lỗi:', err.message);
    throw err; // router sẽ xử lý
  }
};
