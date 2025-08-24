const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController'); // path tới controller bạn vừa tạo

// 1️⃣ Nhập external factors tuần mới (chưa dự đoán)
router.post('/external-factors', testController.addExternalFactorsTest);

// 2️⃣ Cập nhật actual weekly sales (đã xong tuần, để đánh giá accuracy)
router.post('/actual-sales', testController.updateActualSalesTest);

module.exports = router;
