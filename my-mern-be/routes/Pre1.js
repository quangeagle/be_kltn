// routes/predictionRoutes.js
const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/predic1');
const { verifyToken, isSupplier } = require('../middleware/authMiddleware');
router.post('/predict', verifyToken, isSupplier, predictionController.handlePrediction);
// Chạy dự đoán

// Cập nhật actual sales
router.put('/actual-sales', predictionController.updateActualSalesTest);

// Lấy prediction logs
router.get('/logs', predictionController.getPredictionTestLogs);
router.post('/predict-from-input', verifyToken, isSupplier, predictionController.handlePredictionFromInput);
module.exports = router;
