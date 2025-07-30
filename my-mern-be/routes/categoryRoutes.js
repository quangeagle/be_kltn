const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Admin tạo ngành hàng
router.post('/category-groups', categoryController.createCategoryGroup);

// Admin tạo danh mục
router.post('/categories', categoryController.createCategory);

// Lấy tất cả ngành hàng
router.get('/category-groups', categoryController.getAllCategoryGroups);

// Lấy danh mục theo ngành hàng
router.get('/categories/:groupId', categoryController.getCategoriesByGroup);
router.get('/categories', categoryController.getAllCategories);
module.exports = router;
