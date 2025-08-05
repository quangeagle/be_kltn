// routes/weather.js
const express = require('express');
const router = express.Router();
const { updateTemperatureForAll } = require('../services/weatherUpdater');

router.put('/update-temperature', async (req, res) => {
  try {
    await updateTemperatureForAll();
    res.status(200).json({ message: '✅ Đã cập nhật nhiệt độ cho các supplier' });
  } catch (err) {
    console.error('❌ Lỗi cập nhật nhiệt độ:', err.message);
    res.status(500).json({ error: 'Cập nhật thất bại' });
  }
});

module.exports = router;
