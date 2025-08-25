const express = require('express');
const router = express.Router();
const predictionLogController = require('../controllers/predictionLogController');

// 🆕 Tạo bản ghi PredictionLog mới cho tuần tiếp theo
router.post('/create-next-week', predictionLogController.createNextWeekPredictionLog);

// 📋 Lấy danh sách PredictionLog (có phân trang và filter)
router.get('/', predictionLogController.getPredictionLogs);

// 🔍 Lấy PredictionLog theo ID
router.get('/:id', predictionLogController.getPredictionLogById);

// 🗑️ Xóa PredictionLog
router.delete('/:id', predictionLogController.deletePredictionLog);
router.post('/them-log', predictionLogController.createPredictionLog);
router.post('/external-factors', predictionLogController.createExternalFactors);
module.exports = router;
