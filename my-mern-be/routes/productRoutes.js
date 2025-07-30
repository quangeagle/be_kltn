const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken, isAdmin, isSupplier } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
// ✅ Supplier tạo sản phẩm
router.post('/', verifyToken, isSupplier, upload.array('images', 10), productController.createProduct);
// 📤 Supplier cập nhật sản phẩm
router.put('/:id', verifyToken, isSupplier, upload.array('images', 10), productController.updateProduct);
// ✅ Admin duyệt sản phẩm
router.patch('/:id/approve', verifyToken, isAdmin, productController.approveProduct);

// ✅ Admin từ chối sản phẩm
router.patch('/:id/reject', verifyToken, isAdmin, productController.rejectProduct);
// Admin xem sản phẩm theo supplier và status
router.get('/supplier/:supplierId', verifyToken, isAdmin, productController.getProductsBySupplierAndStatus);

// User xem sản phẩm theo category (đã được duyệt)
router.get('/category/:categoryId', productController.getProductsByCategory);
router.get('/supplier2/:supplierId', productController.getApprovedProductsBySupplier);
router.get('/all', productController.getAllApprovedProducts);  
// Xem chi tiết sản phẩm (chỉ khi đã được duyệt)
router.get('/:id', productController.getProductDetail);
module.exports = router;
