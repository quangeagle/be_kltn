const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, isSupplier } = require('../middleware/authMiddleware');
router.post('/place', orderController.placeOrder);
router.put('/cancel/:orderId', orderController.cancelOrder);
router.put('/approve/:orderId', orderController.approveOrder);
router.get('/supplier', verifyToken, isSupplier, orderController.getOrdersBySupplier);
module.exports = router;
