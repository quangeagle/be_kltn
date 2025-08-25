const express = require('express');
const router = express.Router();
const predictionTestController = require('../controllers/predic2');

// 📌 1. Chạy dự đoán tuần kế tiếp (GRU + XGB)
router.post('/run', predictionTestController.handlePredictionTest);

// 📌 2. Cập nhật doanh số thực tế sau khi có số liệu
router.put('/update-actual', predictionTestController.updateActualSalesTest);

// 📌 3. Xem danh sách log (có phân trang + filter)
router.get('/logs', predictionTestController.getPredictionTestLogs);

// 📌 4. Lấy dữ liệu so sánh và tính toán độ chính xác của 2 mô hình
router.get('/accuracy-comparison', predictionTestController.getModelAccuracyComparison);

// 📌 5. Lấy thống kê tổng quan về hiệu suất của các model
router.get('/performance-summary', predictionTestController.getModelPerformanceSummary);

// 📌 6. Debug dữ liệu để kiểm tra
router.get('/debug', predictionTestController.debugData);

module.exports = router;
