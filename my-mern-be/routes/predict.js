const express = require('express');
const router = express.Router();
const { predictNextWeekRevenue } = require('../services/predictor');

// POST /api/predict/:supplierId
router.post('/:supplierId', async (req, res) => {
  try {
    const supplierId = req.params.supplierId;
    const predictedSales = await predictNextWeekRevenue(supplierId);

    res.json({
      xgb: predictedSales.xgb,
      gru: predictedSales.gru
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi khi dự đoán' });
  }
});

module.exports = router;
