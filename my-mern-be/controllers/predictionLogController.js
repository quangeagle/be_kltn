const moment = require('moment');
const WeeklySalesInput = require('../models/WeeklySalesInput');
const PredictionLog = require('../models/PredictionLog');
const Supplier = require('../models/Supplier');

// Tạo bản ghi PredictionLog mới cho tuần tiếp theo
exports.createNextWeekPredictionLog = async (req, res) => {
  try {
    console.log('🆕 Bắt đầu tạo bản ghi PredictionLog cho tuần tiếp theo...');

    // Lấy tuần mới nhất từ WeeklySalesInput
    const latestWeeklySales = await WeeklySalesInput.findOne({})
      .sort({ 'items.weekStart': -1 })
      .limit(1);

    if (!latestWeeklySales || !latestWeeklySales.items || latestWeeklySales.items.length === 0) {
      return res.status(400).json({ 
        error: 'Không có dữ liệu WeeklySalesInput để xác định tuần tiếp theo' 
      });
    }

    // Sắp xếp items theo weekStart để lấy tuần mới nhất
    const sortedItems = latestWeeklySales.items.sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));
    const latestWeek = sortedItems[sortedItems.length - 1];

    console.log('📅 Tuần mới nhất trong WeeklySalesInput:', latestWeek.weekStart);
    console.log('📊 WeekIndex:', latestWeek.weekIndex);
    console.log('📈 WeekOfYear:', latestWeek.weekOfYear);
    console.log('📅 Year:', latestWeek.year);

    // Tính tuần tiếp theo
    const nextWeekStart = moment(latestWeek.weekStart).add(1, 'weeks').startOf('isoWeek');
    const nextWeekOfYear = nextWeekStart.isoWeek();
    const nextYear = nextWeekStart.isoWeekYear();

    console.log('🆕 Tuần tiếp theo sẽ là:', nextWeekStart.format('YYYY-MM-DD'));
    console.log('📊 WeekOfYear:', nextWeekOfYear);
    console.log('📅 Year:', nextYear);

    // Kiểm tra xem đã có bản ghi cho tuần này chưa
    const existingLog = await PredictionLog.findOne({
      weekOfYear: nextWeekOfYear,
      year: nextYear
    });

    if (existingLog) {
      return res.status(400).json({
        error: `Đã có bản ghi PredictionLog cho tuần ${nextWeekOfYear}/${nextYear}`,
        existingLog: {
          _id: existingLog._id,
          weekStart: existingLog.weekStart,
          weekOfYear: existingLog.weekOfYear,
          year: existingLog.year
        }
      });
    }

    // Lấy danh sách suppliers
    const suppliers = await Supplier.find({});
    if (suppliers.length === 0) {
      return res.status(400).json({ error: 'Không có supplier nào trong hệ thống' });
    }

    console.log(`🏪 Tìm thấy ${suppliers.length} suppliers`);

    // Tạo bản ghi PredictionLog cho mỗi supplier
    const createdLogs = [];

    for (const supplier of suppliers) {
      // Tính toán các trường thời gian tự động
      const month = nextWeekStart.month() + 1; // moment month() trả về 0-11
      const dayOfWeek = nextWeekStart.isoWeekday(); // 1-7 (Thứ 2 = 1, Chủ nhật = 7)
      const isWeekend = [6, 7].includes(dayOfWeek) ? 1 : 0;

      // Lấy dữ liệu từ tuần trước để làm giá trị mặc định
      const previousWeek = sortedItems[sortedItems.length - 1];
      
      const newPredictionLog = new PredictionLog({
        supplier: supplier._id,
        weekStart: nextWeekStart.toDate(),
        weekOfYear: nextWeekOfYear,
        year: nextYear,
        
        // Các trường dự đoán để trống (sẽ được điền khi dự đoán)
        predictedByXGB: null,
        predictedByGRU: null,
        actualWeeklySales: 0,
        predictions: [], // Array rỗng, sẽ được điền khi dự đoán
        
        // Các trường external factors với giá trị mặc định
        externalFactorsCurrent: {
          holidayFlag: 0, // Mặc định không có ngày lễ
          temperature: null, // Sẽ được cập nhật từ GitHub Action
          fuelPrice: null, // Sẽ được cập nhật từ GitHub Action
          cpi: previousWeek.cpi || 0, // Lấy từ tuần trước
          unemployment: previousWeek.unemployment || 0, // Lấy từ tuần trước
          month: month,
          weekOfYear: nextWeekOfYear,
          year: nextYear,
          dayOfWeek: dayOfWeek,
          isWeekend: isWeekend
        }
      });

      const savedLog = await newPredictionLog.save();
      createdLogs.push({
        supplierId: supplier._id,
        supplierName: supplier.name || 'Unknown',
        weekStart: savedLog.weekStart,
        weekOfYear: savedLog.weekOfYear,
        year: savedLog.year
      });

      console.log(`✅ Đã tạo PredictionLog cho supplier: ${supplier.name || supplier._id}`);
    }

    console.log(`🎉 Hoàn tất tạo ${createdLogs.length} bản ghi PredictionLog`);

    return res.json({
      success: true,
      message: `Đã tạo ${createdLogs.length} bản ghi PredictionLog cho tuần ${nextWeekOfYear}/${nextYear}`,
      nextWeek: {
        weekStart: nextWeekStart.format('YYYY-MM-DD'),
        weekOfYear: nextWeekOfYear,
        year: nextYear
      },
      createdLogs: createdLogs,
      note: 'Các trường temperature và fuelPrice sẽ được cập nhật từ GitHub Action'
    });

  } catch (error) {
    console.error('❌ Lỗi tạo PredictionLog:', error);
    return res.status(500).json({
      error: 'Lỗi server khi tạo PredictionLog',
      details: error.message
    });
  }
};

// Lấy danh sách PredictionLog (có phân trang và filter)
exports.getPredictionLogs = async (req, res) => {
  try {
    const { supplier, year, weekOfYear, page = 1, limit = 20 } = req.query;

    let filter = {};
    if (supplier) filter.supplier = supplier;
    if (year) filter.year = parseInt(year);
    if (weekOfYear) filter.weekOfYear = parseInt(weekOfYear);

    const skip = (page - 1) * limit;

    const logs = await PredictionLog.find(filter)
      .populate('supplier', 'name email')
      .sort({ year: -1, weekOfYear: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await PredictionLog.countDocuments(filter);

    return res.json({
      success: true,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
      data: logs
    });

  } catch (error) {
    console.error('❌ Lỗi lấy PredictionLogs:', error);
    return res.status(500).json({
      error: 'Lỗi server khi lấy PredictionLogs',
      details: error.message
    });
  }
};

// Lấy PredictionLog theo ID
exports.getPredictionLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await PredictionLog.findById(id)
      .populate('supplier', 'name email')
      .lean();

    if (!log) {
      return res.status(404).json({ error: 'Không tìm thấy PredictionLog' });
    }

    return res.json({
      success: true,
      data: log
    });

  } catch (error) {
    console.error('❌ Lỗi lấy PredictionLog:', error);
    return res.status(500).json({
      error: 'Lỗi server khi lấy PredictionLog',
      details: error.message
    });
  }
};

// Xóa PredictionLog
exports.deletePredictionLog = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedLog = await PredictionLog.findByIdAndDelete(id);

    if (!deletedLog) {
      return res.status(404).json({ error: 'Không tìm thấy PredictionLog để xóa' });
    }

    return res.json({
      success: true,
      message: 'Đã xóa PredictionLog thành công',
      deletedLog: {
        _id: deletedLog._id,
        weekStart: deletedLog.weekStart,
        weekOfYear: deletedLog.weekOfYear,
        year: deletedLog.year
      }
    });

  } catch (error) {
    console.error('❌ Lỗi xóa PredictionLog:', error);
    return res.status(500).json({
      error: 'Lỗi server khi xóa PredictionLog',
      details: error.message
    });
  }
};
exports.createPredictionLog = async (req, res) => {
  try {
    const {
      supplier,
      weekStart,
      weekOfYear,
      year,
      predictedByXGB,
      predictedByGRU,
      actualWeeklySales,
      predictions,
      externalFactorsCurrent
    } = req.body;

    const newLog = new PredictionLog({
      supplier,
      weekStart,
      weekOfYear,
      year,
      predictedByXGB,
      predictedByGRU,
      actualWeeklySales,
      predictions,
      externalFactorsCurrent
    });

    await newLog.save();

    res.status(201).json({
      message: '✅ PredictionLog created successfully',
      data: newLog
    });
  } catch (error) {
    console.error('❌ Error creating PredictionLog:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET all logs
exports.getAllPredictionLogs = async (req, res) => {
  try {
    const logs = await PredictionLog.find().populate('supplier');
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET logs by week + year
exports.getPredictionLogByWeekYear = async (req, res) => {
  try {
    const { weekOfYear, year } = req.params;
    const log = await PredictionLog.findOne({ weekOfYear, year }).populate('supplier');

    if (!log) return res.status(404).json({ message: '❌ Not found' });

    res.status(200).json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.createExternalFactors = async (req, res) => {
  try {
    const { supplier, weekStart, externalFactorsCurrent } = req.body;

    if (!supplier || !weekStart || !externalFactorsCurrent) {
      return res.status(400).json({ message: '❌ supplier, weekStart và externalFactorsCurrent là bắt buộc' });
    }

    const newLog = new PredictionLog({
      supplier,
      weekStart,
      weekOfYear: externalFactorsCurrent.weekOfYear,
      year: externalFactorsCurrent.year,
      externalFactorsCurrent
    });

    await newLog.save();

    res.status(201).json({
      message: '✅ External factors log created successfully',
      data: newLog
    });
  } catch (error) {
    console.error('❌ Error creating external factors log:', error);
    res.status(500).json({ error: error.message });
  }
};