const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.post('/place', orderController.placeOrder);
router.put('/cancel/:orderId', orderController.cancelOrder);
router.put('/approve/:orderId', orderController.approveOrder);

module.exports = router;
