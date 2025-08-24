const express = require('express');
const router = express.Router();
const { updateCurrentWeekData, smartUpdateData, updateNewWeekData } = require('../services/smartDataUpdater');

// 🔄 Cập nhật dữ liệu tuần hiện tại (cho GitHub Action - 10 phút/lần)
router.get('/current-week', async (req, res) => {
  try {
    console.log('🔄 API: Cập nhật dữ liệu tuần hiện tại (GitHub Action)...');
    await updateCurrentWeekData();
    
    res.json({
      success: true,
      message: 'Cập nhật dữ liệu tuần hiện tại thành công',
      timestamp: new Date().toISOString(),
      purpose: 'GitHub Action - cập nhật mỗi 10 phút để người dùng có thể dự đoán ngay lập tức'
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật tuần hiện tại:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 🧠 Cập nhật dữ liệu thông minh (kiểm tra ngày và cập nhật phù hợp)
router.get('/smart', async (req, res) => {
  try {
    console.log('🧠 API: Cập nhật dữ liệu thông minh...');
    await smartUpdateData();
    
    res.json({
      success: true,
      message: 'Cập nhật dữ liệu thông minh thành công',
      timestamp: new Date().toISOString(),
      purpose: 'Cập nhật thông minh - luôn cập nhật tuần hiện tại, thứ 2 thì cập nhật thêm tuần mới'
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật thông minh:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 🆕 Cập nhật dữ liệu tuần mới (chỉ chạy vào thứ 2)
router.get('/new-week', async (req, res) => {
  try {
    console.log('🆕 API: Cập nhật dữ liệu tuần mới...');
    await updateNewWeekData();
    
    res.json({
      success: true,
      message: 'Cập nhật dữ liệu tuần mới thành công',
      timestamp: new Date().toISOString(),
      purpose: 'Cập nhật tuần mới - chỉ chạy vào thứ 2'
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật tuần mới:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
