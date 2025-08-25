const express = require('express');
const router = express.Router();
const predictionTestLogController = require('../controllers/predictionTestLogController');

// POST nhập tay dữ liệu test
router.post('/test-log', predictionTestLogController.createOrUpdateTestLog);
router.post('/seed', predictionTestLogController.seedDemoData);
module.exports = router;
