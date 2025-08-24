const express = require('express');
const router = express.Router();
const weeklySaleInputController = require('../controllers/weeklySaleInputcontroller');

// Thêm 1 tuần mới (push vào cuối mảng, giữ tối đa 10)
router.post('/add', weeklySaleInputController.addWeeklySale);

// Lấy danh sách 10 tuần hiện tại
router.get('/', weeklySaleInputController.getWeeklySales);

// Reset toàn bộ (xóa hết mảng)
router.delete('/reset', weeklySaleInputController.resetWeeklySales);
router.post('/add-batch', weeklySaleInputController.addBatchWeeks);
module.exports = router;
