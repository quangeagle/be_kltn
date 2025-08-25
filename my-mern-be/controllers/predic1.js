const moment = require('moment');
const axios = require('axios');
const PredictionLog = require('../models/PredictionLog');
const WeeklySalesInput = require('../models/WeeklySalesInput');

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
exports.handlePrediction = async (req, res) => {
    try {
      console.log("📩 Nhận request body:", JSON.stringify(req.body, null, 2));
  
      const supplierId = req.user.id; // ✅ lấy từ token
    if (!supplierId) {
      return res.status(400).json({ error: "Không tìm thấy supplierId trong token" });
    }
    console.log("🔑 Supplier ID:", supplierId);
  
      // Lấy test input
      const testRecord = await WeeklySalesInput.findOne({});
      if (!testRecord || !testRecord.items || testRecord.items.length === 0) {
        console.warn("⚠️ Không tìm thấy dữ liệu test input trong WeeklySalesInput");
        return res.status(400).json({ error: 'Không có dữ liệu test input' });
      }
  
      const sortedItems = testRecord.items
        .slice()
        .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));
  
      const lastWeek = sortedItems[sortedItems.length - 1];
      console.log("📅 lastWeek:", lastWeek);
  
      const weekToPredictMoment = moment(lastWeek.weekStart)
        .add(1, 'weeks')
        .startOf('isoWeek');
      const weekStart = weekToPredictMoment.toDate();
      console.log("📅 weekStart để dự đoán:", weekStart);
  
      // Lấy lịch sử 10 tuần
      let salesHistory = sortedItems.slice(-10).map(item => item.weeklySales);
      while (salesHistory.length < 10) salesHistory.unshift(0);
      salesHistory = salesHistory.slice(-10);
  
      console.log("📤 Payload gửi GRU:", { sales_history: salesHistory });
  
      const externalFactorsPrevious = {
        Temperature: lastWeek.temperature,
        Fuel_Price: lastWeek.fuelPrice,
        CPI: lastWeek.cpi,
        Unemployment: lastWeek.unemployment
      };
  
      // Lấy externalFactorsCurrent từ bản ghi PredictionLog gần nhất của supplier
      const latestLog = await PredictionLog.findOne({ supplier: supplierId })
        .sort({ weekStart: -1 })
        .lean();

      const baseCurrentFactors = latestLog?.externalFactorsCurrent || {
        holidayFlag: lastWeek.holidayFlag,
        temperature: lastWeek.temperature,
        fuelPrice: lastWeek.fuelPrice,
        cpi: lastWeek.cpi,
        unemployment: lastWeek.unemployment
      };

      const externalFactorsCurrent = {
        holidayFlag: baseCurrentFactors.holidayFlag,
        temperature: baseCurrentFactors.temperature,
        fuelPrice: baseCurrentFactors.fuelPrice,
        cpi: baseCurrentFactors.cpi,
        unemployment: baseCurrentFactors.unemployment,
        month: weekToPredictMoment.month() + 1,
        weekOfYear: weekToPredictMoment.isoWeek(),
        year: weekToPredictMoment.isoWeekYear(),
        dayOfWeek: weekToPredictMoment.isoWeekday(),
        isWeekend: [6, 7].includes(weekToPredictMoment.isoWeekday()) ? 1 : 0
      };
      console.log("🌡️ externalFactorsCurrent:", externalFactorsCurrent);
  
      // gọi GRU
      const gruRes = await retryWithBackoff(() =>
        axios.post('https://deploy-modelai-1.onrender.com/gru-standalone', {
          sales_history: salesHistory
        })
      );
      console.log("🤖 GRU response:", gruRes.data);
  
      await delay(1000);
  
      // gọi XGB
      let xgbRes = null;
      try {
        xgbRes = await retryWithBackoff(() =>
          axios.post('https://deploy-modelai-1.onrender.com/gru-ensemble', {
            sales_history: salesHistory,
            external_factors_current: externalFactorsCurrent,
            external_factors_previous: externalFactorsPrevious
          })
        );
        console.log("🤖 XGB response:", xgbRes.data);
      } catch (xgbError) {
        console.error('❌ XGB API error:', xgbError.message);
        xgbRes = {
          data: {
            prediction: {
              final_prediction: null,
              confidence_score: null
            },
            xgboost_explanation: null
          }
        };
      }
  
      // ⚡ Cập nhật duy nhất theo supplierId
      const log = await PredictionLog.findOneAndUpdate(
        { supplier: supplierId }, // chỉ filter theo supplier
        {
          supplier: supplierId,
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
              logs: gruRes.data,
              featureImportance: null
            },
            {
              modelUsed: 'XGB',
              predictedSales: xgbRes?.data?.prediction?.final_prediction || null,
              confidenceScore: xgbRes?.data?.prediction?.confidence_score || null,
              trend: xgbRes?.data?.prediction?.ensemble_breakdown?.adjustment_percentage
                ? (xgbRes.data.prediction.ensemble_breakdown.adjustment_percentage > 0
                    ? 'increasing'
                    : 'decreasing')
                : null,
              logs: xgbRes?.data?.prediction || null,
              featureImportance: xgbRes?.data?.xgboost_explanation || null
            }
          ]
        },
        { upsert: true, new: true }
      );
  
      console.log("📝 PredictionLog saved:", log._id);
      return res.json(log);
    } catch (err) {
      console.error('❌ Lỗi handlePrediction:', err.message, err.stack);
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
    const log = await PredictionLog.findOne({ weekStart });

    if (!log) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi test prediction tuần này' });
    }

    log.actualWeeklySales = actualWeeklySales;
    await log.save();

    return res.json({ message: 'Cập nhật actual sales logs thành công', data: log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật actual sales logs' });
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

    const logs = await PredictionLog.find(filter)
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
    console.error('Error fetching prediction logs:', err);
    res.status(500).json({ error: 'Server error khi lấy prediction logs' });
  }
};
exports.handlePredictionFromInput = async (req, res) => {
  try {
    console.log("📩 Nhận request body:", JSON.stringify(req.body, null, 2));

    const supplierId = req.user.id; // ✅ lấy từ token
    if (!supplierId) {
      return res.status(400).json({ error: "Không tìm thấy supplierId trong token" });
    }
    console.log("🔑 Supplier ID:", supplierId);

    const { salesHistory, externalFactorsPrevious, externalFactorsCurrent } = req.body;

    if (!salesHistory || salesHistory.length < 10) {
      return res.status(400).json({ error: "Cần nhập đủ 10 tuần doanh thu" });
    }

    if (!externalFactorsPrevious || !externalFactorsCurrent) {
      return res.status(400).json({ error: "Thiếu external factors" });
    }

    // ⚡ Chuẩn hóa kiểu dữ liệu
    const normalizedExternalFactorsCurrent = {
      ...externalFactorsCurrent,
      holidayFlag: parseInt(externalFactorsCurrent.holidayFlag) || 0,
      isWeekend: parseInt(externalFactorsCurrent.isWeekend) || 0,
      temperature: parseFloat(externalFactorsCurrent.temperature) || 0,
      fuelPrice: parseFloat(externalFactorsCurrent.fuelPrice) || 0,
      cpi: parseFloat(externalFactorsCurrent.cpi) || 0,
      unemployment: parseFloat(externalFactorsCurrent.unemployment) || 0,
      month: parseInt(externalFactorsCurrent.month) || 1,
      weekOfYear: parseInt(externalFactorsCurrent.weekOfYear) || 1,
      year: parseInt(externalFactorsCurrent.year) || 2024,
      dayOfWeek: parseInt(externalFactorsCurrent.dayOfWeek) || 1
    };

    const normalizedExternalFactorsPrevious = {
      temperature: parseFloat(externalFactorsPrevious.Temperature) || 0,
      fuelPrice: parseFloat(externalFactorsPrevious.Fuel_Price) || 0,
      cpi: parseFloat(externalFactorsPrevious.CPI) || 0,
      unemployment: parseFloat(externalFactorsPrevious.Unemployment) || 0
    };

    console.log("✅ Validation passed - salesHistory length:", salesHistory.length);
    console.log("✅ externalFactorsPrevious (normalized):", normalizedExternalFactorsPrevious);
    console.log("✅ externalFactorsCurrent (normalized):", normalizedExternalFactorsCurrent);

    // ⚡ Đảm bảo salesHistory luôn là 10 tuần
    let history = salesHistory.slice(-10);
    while (history.length < 10) history.unshift(0);

    console.log("📤 Payload gửi GRU:", { sales_history: history });
    console.log("🌡️ externalFactorsPrevious (normalized):", normalizedExternalFactorsPrevious);
    console.log("🌡️ externalFactorsCurrent (normalized):", normalizedExternalFactorsCurrent);

         // gọi GRU
     console.log("🚀 Gọi GRU API với payload:", { sales_history: history });
     let gruRes = null;
     try {
       gruRes = await retryWithBackoff(() =>
         axios.post("https://deploy-modelai-1.onrender.com/gru-standalone", {
           sales_history: history
         })
       );
       console.log("🤖 GRU response:", gruRes.data);
     } catch (gruError) {
       console.error("❌ GRU API error:", gruError.message);
       return res.status(500).json({ 
         error: "GRU API error", 
         details: gruError.message,
         message: "Không thể kết nối với model GRU"
       });
     }

    await delay(1000);

         // gọi XGB
     let xgbRes = null;
     try {
       console.log("🚀 Gọi XGB API với payload:", {
         sales_history: history,
         external_factors_current: normalizedExternalFactorsCurrent,
         external_factors_previous: normalizedExternalFactorsPrevious
       });
       xgbRes = await retryWithBackoff(() =>
         axios.post("https://deploy-modelai-1.onrender.com/gru-ensemble", {
           sales_history: history,
           external_factors_current: normalizedExternalFactorsCurrent,
           external_factors_previous: normalizedExternalFactorsPrevious
         })
       );
       console.log("🤖 XGB response:", xgbRes.data);
     } catch (xgbError) {
       console.error("❌ XGB API error:", xgbError.message);
       xgbRes = {
         data: {
           prediction: {
             final_prediction: null,
             confidence_score: null
           },
           xgboost_explanation: null
         }
       };
     }

         // ⚡ Trả về kết quả dự đoán (không lưu DB)
     console.log("🔧 Chuẩn bị tạo kết quả dự đoán...");
     
     const predictionResult = {
       supplierId,
       weekStart: new Date(),
       weekOfYear: normalizedExternalFactorsCurrent.weekOfYear,
       year: normalizedExternalFactorsCurrent.year,
               predictions: [
          {
            modelUsed: "GRU",
            predictedSales: gruRes.data.predicted_sales,
            confidenceScore: gruRes.data.confidence_score || null,
            trend: gruRes.data.trend_detected || null,
            logs: gruRes.data,
            featureImportance: null
          },
          {
            modelUsed: "XGB",
            predictedSales: xgbRes?.data?.prediction?.final_prediction || null,
            confidenceScore: xgbRes?.data?.prediction?.confidence_score || null,
            trend: xgbRes?.data?.prediction?.ensemble_breakdown?.adjustment_percentage
              ? (xgbRes.data.prediction.ensemble_breakdown.adjustment_percentage > 0
                  ? "increasing"
                  : "decreasing")
              : null,
            logs: xgbRes?.data?.prediction || null,
            featureImportance: xgbRes?.data?.xgboost_explanation || null
          }
        ],
       externalFactorsCurrent: normalizedExternalFactorsCurrent,
       externalFactorsPrevious: normalizedExternalFactorsPrevious,
       message: "Dự đoán thành công - không lưu vào database"
     };

     console.log("✅ Trả về kết quả dự đoán:", predictionResult);
     console.log("📤 Gửi response về client...");
     return res.json(predictionResult);
  } catch (err) {
    console.error("❌ Lỗi handlePredictionFromInput:", err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
};