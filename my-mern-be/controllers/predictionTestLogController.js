const PredictionTestLog = require('../models/PredictionTestLog');

// Tạo hoặc cập nhật log dự đoán test
exports.createOrUpdateTestLog = async (req, res) => {
  try {
    const { weekOfYear, year, actualWeeklySales, predictedByXGB, predictedByGRU } = req.body;

    if (!weekOfYear || !year) {
      return res.status(400).json({ error: 'weekOfYear và year là bắt buộc' });
    }

    // Tạo ngày bắt đầu tuần (giả định: thứ 2 đầu tuần)
    const weekStart = new Date(year, 0, 1 + (weekOfYear - 1) * 7);

    // Tìm xem tuần/năm này đã có log chưa
    let log = await PredictionTestLog.findOne({ weekOfYear, year });

    if (log) {
      // Cập nhật log cũ
      log.actualWeeklySales = actualWeeklySales ?? log.actualWeeklySales;
      log.predictedByXGB = predictedByXGB ?? log.predictedByXGB;
      log.predictedByGRU = predictedByGRU ?? log.predictedByGRU;
      log.weekStart = weekStart;

      await log.save();
      return res.json({ message: 'Cập nhật log thành công', data: log });
    } else {
      // Tạo log mới
      log = new PredictionTestLog({
        weekStart,
        weekOfYear,
        year,
        actualWeeklySales,
        predictedByXGB,
        predictedByGRU
      });

      await log.save();
      return res.status(201).json({ message: 'Tạo log mới thành công', data: log });
    }
  } catch (error) {
    console.error('❌ Lỗi createOrUpdateTestLog:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.seedDemoData = async (req, res) => {
  try {
    const year = 2010;
    const startWeek = 16;
    const endWeek = 25;

    let docs = [];

    for (let week = startWeek; week <= endWeek; week++) {
      // Cứ lấy ngày chủ nhật làm weekStart (giả định)
      let weekStartDate = new Date(year, 0, 1 + (week - 1) * 7);

      docs.push({
        weekStart: weekStartDate,
        weekOfYear: week,
        year: year,
        predictedByXGB: Math.floor(1000000 + Math.random() * 500000), // random demo
        predictedByGRU: Math.floor(1000000 + Math.random() * 500000), // random demo
        actualWeeklySales: 0, // demo
        predictions: [
          {
            modelUsed: 'XGB',
            predictedSales: Math.floor(1000000 + Math.random() * 500000)
          },
          {
            modelUsed: 'GRU',
            predictedSales: Math.floor(1000000 + Math.random() * 500000)
          }
        ]
      });
    }

    await PredictionTestLog.insertMany(docs);

    res.json({
      message: `Demo data for week ${startWeek} - ${endWeek} of ${year} created successfully`,
      inserted: docs.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};