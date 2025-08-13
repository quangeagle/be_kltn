const express = require('express');
const router = express.Router();
const weeklySalesInputController = require('../controllers/weeklySalesInputController');
const { updateActualSales } = require('../controllers/predictionController');

// POST /api/weekly-sales/sample-data
router.post('/sample-data', weeklySalesInputController.createSampleData);
router.post('/:supplierId/update-actual-sales', updateActualSales);

module.exports = router;
