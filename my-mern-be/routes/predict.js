const express = require('express');
const router = express.Router();
const { handlePrediction } = require('../controllers/predictionController');
const PredictionLog = require('../models/PredictionLog');
const moment = require('moment');
const { updateActualSales, getPredictionLogs } = require('../controllers/predictionController');
const { addOrUpdateWeeklyExternalFactors2 } = require('../controllers/predictionController');
// POST /api/predict/:supplierId
router.post('/:supplierId', async (req, res) => {
  try {
    const supplierId = req.params.supplierId;
    const result = await handlePrediction(supplierId); // 🔁 Gọi controller

    res.json(result); // Trả lại xgb và gru
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi khi dự đoán' });
  }
});

// routes/predict.js
router.get('/:supplierId/next-week', async (req, res) => {
  const supplierId = req.params.supplierId;
  const now = moment();
  const weekStart = now.startOf('isoWeek').toDate();

  try {
    const prediction = await PredictionLog.findOne({
      supplier: supplierId,
      weekStart,
    });

    if (!prediction) {
      return res.status(404).json({ error: 'Chưa có dự đoán cho tuần này.' });
    }

    res.json({
      weekStart: prediction.weekStart,
      weekOfYear: prediction.weekOfYear,
      year: prediction.year,
      predictedByXGB: prediction.predictedByXGB,
      predictedByGRU: prediction.predictedByGRU,
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi lấy dự đoán tuần tới.' });
  }
});
router.get('/:supplierId/current-week', async (req, res) => {
  const supplierId = req.params.supplierId;
  const now = moment();
  const weekStart = now.startOf('isoWeek').toDate();

  try {
    const prediction = await PredictionLog.findOne({
      supplier: supplierId,
      weekStart,
    });

    if (!prediction) {
      return res.status(404).json({ error: 'Chưa có dữ liệu tuần hiện tại.' });
    }

    res.json({
      weekStart: prediction.weekStart,
      weekOfYear: prediction.weekOfYear,
      year: prediction.year,
      predictedByXGB: prediction.predictedByXGB,
      predictedByGRU: prediction.predictedByGRU,
      actualWeeklySales: prediction.actualWeeklySales || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu tuần hiện tại.' });
  }
});
router.get('/:supplierId/summary', async (req, res) => {
  const supplierId = req.params.supplierId;

  try {
    const logs = await PredictionLog.find({ supplier: supplierId }).sort({ weekStart: 1 });

    const result = logs.map(log => ({
      weekOfYear: log.weekOfYear,
      year: log.year,
      predictedByXGB: log.predictedByXGB,
      predictedByGRU: log.predictedByGRU,
      actualWeeklySales: log.actualWeeklySales || 0,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi lấy lịch sử dự đoán.' });
  }
});
router.post('/:supplierId/update-actual-sales', updateActualSales);
router.post('/:supplierId/add-or-update-weekly-external-factors', addOrUpdateWeeklyExternalFactors2);
router.get('/:supplierId/prediction-logs', getPredictionLogs);
module.exports = router;

