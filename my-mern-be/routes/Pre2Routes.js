const express = require('express');
const router = express.Router();
const predictionTestController = require('../controllers/predic2');

// 📌 1. Chạy dự đoán tuần kế tiếp (GRU + XGB)
router.post('/run', predictionTestController.handlePredictionTest);

// 📌 2. Cập nhật doanh số thực tế sau khi có số liệu
router.put('/update-actual', predictionTestController.updateActualSalesTest);

// 📌 3. Xem danh sách log (có phân trang + filter)
router.get('/logs', predictionTestController.getPredictionTestLogs);

module.exports = router;
