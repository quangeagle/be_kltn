const express = require('express');
const router = express.Router();
const { updateFuelPriceForAll } = require('../services/fuelUpdater.js');

router.put('/update-fuel', async (req, res) => {
  try {
    await updateFuelPriceForAll();
    res.status(200).json({ message: '✅ Đã cập nhật giá xăng cho các supplier' });
  } catch (err) {
    console.error('❌ Lỗi cập nhật giá xăng:', err.message);
    res.status(500).json({ error: 'Cập nhật thất bại' });
  }
});

module.exports = router;
