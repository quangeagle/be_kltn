const mongoose = require('mongoose');
const PredictionLog = require('../models/PredictionLog'); // đường dẫn tới model PredictionLog của bạn
require('dotenv').config();
async function createPredictionLog() {
  try {
    // Kết nối DB (nếu chưa kết nối)
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://haoquang16122004:Kidoking258@bekltn.rzrai1y.mongodb.net/test?retryWrites=true&w=majority&appName=BeKLTN', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://haoquang16122004:Kidoking258@bekltn.rzrai1y.mongodb.net/test?retryWrites=true&w=majority&appName=BeKLTN');
      console.log('✅ Kết nối MongoDB thành công');
    }
    const supplierId = new mongoose.Types.ObjectId('6888403e04cc6e98c7438577');
    const newLog = new PredictionLog({
        supplier: supplierId,
        weekStart: new Date('2010-04-30T00:00:00.000Z'), // tuần 17 năm 2010 (bắt đầu ngày thứ Hai 19/04/2010)
        actualWeeklySales: 1425100.71,
        createdAt: new Date(),
        updatedAt: new Date(),
        externalFactorsCurrent: {
          holidayFlag: 0,
          temperature: 67.41,
          fuelPrice: 2.78,
          cpi: 210.3895456,
          unemployment: 7.808,
          month: 12,
          weekOfYear: 17,
          year: 2010,
          dayOfWeek: 4,    // thứ Năm
          isWeekend: 0
        },
        predictedByGRU: 1,    // nếu chưa có dữ liệu dự đoán
        predictedByXGB: 1,
        weekOfYear: 17,
        year: 2010
      });

    const savedLog = await newLog.save();
    console.log('✅ Tạo bản ghi PredictionLog mới thành công:', savedLog);

    // Ngắt kết nối DB nếu muốn
    // await mongoose.disconnect();

    return savedLog;
  } catch (error) {
    console.error('❌ Lỗi khi tạo PredictionLog:', error);
    throw error;
  }
}

// Nếu chạy file này trực tiếp thì gọi hàm
if (require.main === module) {
  createPredictionLog().then(() => process.exit());
}

module.exports = { createPredictionLog };
