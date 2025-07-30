const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/add', verifyToken, wishlistController.addToWishlist);
router.get('/', verifyToken, wishlistController.getWishlist);
router.delete('/remove', verifyToken, wishlistController.removeFromWishlist);

module.exports = router;
