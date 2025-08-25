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
  if (actual === 0) {
    // Nếu actual = 0, tính accuracy dựa trên predicted
    if (predicted === 0) return 100; // Nếu cả 2 đều 0 thì accuracy = 100%
    return 0; // Nếu predicted khác 0 thì accuracy = 0%
  }
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

// Controller để lấy dữ liệu so sánh và tính toán độ chính xác của 2 mô hình
exports.getModelAccuracyComparison = async (req, res) => {
  try {
    const { year, weekOfYear, page = 1, limit = 20, sortBy = 'weekStart', sortOrder = 'desc' } = req.query;

    // Build filter object
    let filter = {};
    if (year) filter.year = parseInt(year);
    if (weekOfYear) filter.weekOfYear = parseInt(weekOfYear);

    // Lấy những bản ghi có actualWeeklySales (bao gồm cả giá trị 0)
    filter.actualWeeklySales = { $exists: true, $ne: null };

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Query dữ liệu có phân trang và sort
    const logs = await PredictionTestLog.find(filter)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Tính toán độ chính xác và thống kê
    const comparisonData = logs.map(item => {
      const gruAccuracy = calcAccuracy(item.actualWeeklySales, item.predictedByGRU);
      const xgbAccuracy = calcAccuracy(item.actualWeeklySales, item.predictedByXGB);
      
      // Tính sai số tuyệt đối
      const gruAbsoluteError = Math.abs(item.actualWeeklySales - item.predictedByGRU);
      const xgbAbsoluteError = Math.abs(item.actualWeeklySales - item.predictedByXGB);
      
      // Tính sai số tương đối (%)
      const gruRelativeError = item.actualWeeklySales !== 0 ? (gruAbsoluteError / item.actualWeeklySales) * 100 : null;
      const xgbRelativeError = item.actualWeeklySales !== 0 ? (xgbAbsoluteError / item.actualWeeklySales) * 100 : null;

      return {
        weekStart: item.weekStart,
        weekOfYear: item.weekOfYear,
        year: item.year,
        actualWeeklySales: item.actualWeeklySales,
        predictions: {
          GRU: {
            predictedSales: item.predictedByGRU,
            accuracy: gruAccuracy,
            absoluteError: gruAbsoluteError,
            relativeError: gruRelativeError,
            confidenceScore: item.predictions?.find(p => p.modelUsed === 'GRU')?.confidenceScore || null,
            trend: item.predictions?.find(p => p.modelUsed === 'GRU')?.trend || null
          },
          XGB: {
            predictedSales: item.predictedByXGB,
            accuracy: xgbAccuracy,
            absoluteError: xgbAbsoluteError,
            relativeError: xgbRelativeError,
            confidenceScore: item.predictions?.find(p => p.modelUsed === 'XGB')?.confidenceScore || null,
            trend: item.predictions?.find(p => p.modelUsed === 'XGB')?.trend || null
          }
        },
        externalFactors: item.externalFactorsCurrent,
        modelComparison: {
          betterModel: gruAccuracy > xgbAccuracy ? 'GRU' : xgbAccuracy > gruAccuracy ? 'XGB' : 'Equal',
          accuracyDifference: Math.abs(gruAccuracy - xgbAccuracy),
          averageAccuracy: ((gruAccuracy || 0) + (xgbAccuracy || 0)) / 2
        }
      };
    });

    // Tính thống kê tổng hợp
    const totalRecords = await PredictionTestLog.countDocuments(filter);
    const validLogs = logs.filter(log => log.actualWeeklySales !== null && log.actualWeeklySales !== undefined);
    
    if (validLogs.length > 0) {
      const gruAccuracies = validLogs.map(log => calcAccuracy(log.actualWeeklySales, log.predictedByGRU)).filter(acc => acc !== null);
      const xgbAccuracies = validLogs.map(log => calcAccuracy(log.actualWeeklySales, log.predictedByXGB)).filter(acc => acc !== null);
      
      const summary = {
        totalRecords,
        validRecords: validLogs.length,
        averageAccuracy: {
          GRU: gruAccuracies.length > 0 ? (gruAccuracies.reduce((a, b) => a + b, 0) / gruAccuracies.length).toFixed(2) : 0,
          XGB: xgbAccuracies.length > 0 ? (xgbAccuracies.reduce((a, b) => a + b, 0) / xgbAccuracies.length).toFixed(2) : 0
        },
        bestModel: {
          GRU: gruAccuracies.length > 0 ? Math.max(...gruAccuracies).toFixed(2) : 0,
          XGB: xgbAccuracies.length > 0 ? Math.max(...xgbAccuracies).toFixed(2) : 0
        },
        worstModel: {
          GRU: gruAccuracies.length > 0 ? Math.min(...gruAccuracies).toFixed(2) : 0,
          XGB: xgbAccuracies.length > 0 ? Math.min(...xgbAccuracies).toFixed(2) : 0
        },
        modelPerformance: {
          GRU: gruAccuracies.length > 0 ? {
            average: (gruAccuracies.reduce((a, b) => a + b, 0) / gruAccuracies.length).toFixed(2),
            median: gruAccuracies.sort((a, b) => a - b)[Math.floor(gruAccuracies.length / 2)].toFixed(2),
            standardDeviation: Math.sqrt(gruAccuracies.reduce((sq, n) => sq + Math.pow(n - (gruAccuracies.reduce((a, b) => a + b, 0) / gruAccuracies.length), 2), 0) / gruAccuracies.length).toFixed(2)
          } : null,
          XGB: xgbAccuracies.length > 0 ? {
            average: (xgbAccuracies.reduce((a, b) => a + b, 0) / xgbAccuracies.length).toFixed(2),
            median: xgbAccuracies.sort((a, b) => a - b)[Math.floor(xgbAccuracies.length / 2)].toFixed(2),
            standardDeviation: Math.sqrt(xgbAccuracies.reduce((sq, n) => sq + Math.pow(n - (xgbAccuracies.reduce((a, b) => a + b, 0) / xgbAccuracies.length), 2), 0) / xgbAccuracies.length).toFixed(2)
          } : null
        }
      };

      return res.json({
        success: true,
        page: parseInt(page),
        limit: parseInt(limit),
        totalRecords,
        summary,
        data: comparisonData
      });
    } else {
      return res.json({
        success: true,
        page: parseInt(page),
        limit: parseInt(limit),
        totalRecords,
        summary: null,
        data: comparisonData,
        message: 'Không có dữ liệu thực tế để so sánh'
      });
    }

  } catch (err) {
    console.error('❌ Lỗi khi lấy dữ liệu so sánh model:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Lỗi server khi lấy dữ liệu so sánh model',
      details: err.message 
    });
  }
};

// Controller để lấy thống kê tổng quan về hiệu suất của các model
exports.getModelPerformanceSummary = async (req, res) => {
  try {
    const { year, weekOfYear } = req.query;

    // Build filter object
    let filter = { actualWeeklySales: { $exists: true, $ne: null } };
    if (year) filter.year = parseInt(year);
    if (weekOfYear) filter.weekOfYear = parseInt(weekOfYear);

    const logs = await PredictionTestLog.find(filter).lean();

    if (logs.length === 0) {
      return res.json({
        success: true,
        message: 'Không có dữ liệu để phân tích',
        summary: null
      });
    }

    // Phân tích theo từng model
    const gruStats = logs.map(log => ({
      accuracy: calcAccuracy(log.actualWeeklySales, log.predictedByGRU),
      absoluteError: Math.abs(log.actualWeeklySales - log.predictedByGRU),
      relativeError: log.actualWeeklySales !== 0 ? (Math.abs(log.actualWeeklySales - log.predictedByGRU) / log.actualWeeklySales) * 100 : null,
      weekStart: log.weekStart,
      weekOfYear: log.weekOfYear,
      year: log.year
    })).filter(stat => stat.accuracy !== null);

    const xgbStats = logs.map(log => ({
      accuracy: calcAccuracy(log.actualWeeklySales, log.predictedByXGB),
      absoluteError: Math.abs(log.actualWeeklySales - log.predictedByXGB),
      relativeError: log.actualWeeklySales !== 0 ? (Math.abs(log.actualWeeklySales - log.predictedByXGB) / log.actualWeeklySales) * 100 : null,
      weekStart: log.weekStart,
      weekOfYear: log.weekOfYear,
      year: log.year
    })).filter(stat => stat.accuracy !== null);

    // Tính thống kê chi tiết
    const calculateDetailedStats = (stats) => {
      if (stats.length === 0) return null;
      
      const accuracies = stats.map(s => s.accuracy);
      const absoluteErrors = stats.map(s => s.absoluteError);
      const relativeErrors = stats.map(s => s.relativeError);
      
      return {
        count: stats.length,
        accuracy: {
          average: (accuracies.reduce((a, b) => a + b, 0) / accuracies.length).toFixed(2),
          median: accuracies.sort((a, b) => a - b)[Math.floor(accuracies.length / 2)].toFixed(2),
          min: Math.min(...accuracies).toFixed(2),
          max: Math.max(...accuracies).toFixed(2),
          standardDeviation: Math.sqrt(accuracies.reduce((sq, n) => sq + Math.pow(n - (accuracies.reduce((a, b) => a + b, 0) / accuracies.length), 2), 0) / accuracies.length).toFixed(2)
        },
        absoluteError: {
          average: (absoluteErrors.reduce((a, b) => a + b, 0) / absoluteErrors.length).toFixed(2),
          median: absoluteErrors.sort((a, b) => a - b)[Math.floor(absoluteErrors.length / 2)].toFixed(2),
          min: Math.min(...absoluteErrors).toFixed(2),
          max: Math.max(...absoluteErrors).toFixed(2)
        },
        relativeError: {
          average: (relativeErrors.reduce((a, b) => a + b, 0) / relativeErrors.length).toFixed(2),
          median: relativeErrors.sort((a, b) => a - b)[Math.floor(relativeErrors.length / 2)].toFixed(2),
          min: Math.min(...relativeErrors).toFixed(2),
          max: Math.max(...relativeErrors).toFixed(2)
        }
      };
    };

    const summary = {
      totalRecords: logs.length,
      gru: calculateDetailedStats(gruStats),
      xgb: calculateDetailedStats(xgbStats),
      comparison: {
        betterModel: gruStats.length > 0 && xgbStats.length > 0 ? 
          (gruStats.reduce((a, b) => a + b.accuracy, 0) / gruStats.length) > 
          (xgbStats.reduce((a, b) => a + b.accuracy, 0) / xgbStats.length) ? 'GRU' : 'XGB' : 'N/A',
        accuracyDifference: gruStats.length > 0 && xgbStats.length > 0 ? 
          Math.abs(
            (gruStats.reduce((a, b) => a + b.accuracy, 0) / gruStats.length) - 
            (xgbStats.reduce((a, b) => a + b.accuracy, 0) / xgbStats.length)
          ).toFixed(2) : 'N/A'
      },
      topPerformers: {
        gru: gruStats.length > 0 ? gruStats.sort((a, b) => b.accuracy - a.accuracy).slice(0, 5) : [],
        xgb: xgbStats.length > 0 ? xgbStats.sort((a, b) => b.accuracy - a.accuracy).slice(0, 5) : []
      },
      worstPerformers: {
        gru: gruStats.length > 0 ? gruStats.sort((a, b) => a.accuracy - b.accuracy).slice(0, 5) : [],
        xgb: xgbStats.length > 0 ? xgbStats.sort((a, b) => a.accuracy - b.accuracy).slice(0, 5) : []
      }
    };

    return res.json({
      success: true,
      summary
    });

  } catch (err) {
    console.error('❌ Lỗi khi lấy thống kê hiệu suất model:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Lỗi server khi lấy thống kê hiệu suất model',
      details: err.message 
    });
  }
};

// Controller đơn giản để test và debug dữ liệu
exports.debugData = async (req, res) => {
  try {
    const { year, weekOfYear } = req.query;
    
    // Build filter object
    let filter = {};
    if (year) filter.year = parseInt(year);
    if (weekOfYear) filter.weekOfYear = parseInt(weekOfYear);

    console.log('🔍 Filter:', filter);
    
    // Lấy tất cả dữ liệu không filter
    const allLogs = await PredictionTestLog.find({}).lean();
    console.log('📊 Tổng số bản ghi:', allLogs.length);
    
    // Lấy dữ liệu theo filter
    const filteredLogs = await PredictionTestLog.find(filter).lean();
    console.log('🔍 Số bản ghi sau filter:', filteredLogs.length);
    
    // Kiểm tra actualWeeklySales
    const actualSalesStats = allLogs.map(log => ({
      weekStart: log.weekStart,
      weekOfYear: log.weekOfYear,
      year: log.year,
      actualWeeklySales: log.actualWeeklySales,
      predictedByGRU: log.predictedByGRU,
      predictedByXGB: log.predictedByXGB
    }));
    
    return res.json({
      success: true,
      debug: {
        totalRecords: allLogs.length,
        filteredRecords: filteredLogs.length,
        filter: filter,
        sampleData: actualSalesStats.slice(0, 5), // Lấy 5 bản ghi đầu tiên
        actualSalesValues: actualSalesStats.map(s => s.actualWeeklySales),
        uniqueActualSales: [...new Set(actualSalesStats.map(s => s.actualWeeklySales))]
      }
    });

  } catch (err) {
    console.error('❌ Lỗi debug:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Lỗi server khi debug',
      details: err.message 
    });
  }
};
