const express = require('express');
const router = express.Router();
const { getActualRevenue } = require('../controllers/revenueController');

// GET /api/revenue/:supplierId
router.get('/:supplierId', getActualRevenue);

module.exports = router;
