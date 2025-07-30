const CategoryGroup = require('../models/CategoryGroup');
const Category = require('../models/Category');

// Tạo ngành hàng
exports.createCategoryGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    const group = new CategoryGroup({ name, description });
    await group.save();
    res.status(201).json({ message: 'Category group created successfully', group });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Tạo danh mục thuộc ngành hàng
exports.createCategory = async (req, res) => {
  try {
    const { name, groupId } = req.body;
    const category = new Category({ name, group: groupId });
    await category.save();
    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Lấy tất cả ngành hàng
exports.getAllCategoryGroups = async (req, res) => {
  try {
    const groups = await CategoryGroup.find();
    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy tất cả danh mục theo ngành hàng
exports.getCategoriesByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const categories = await Category.find({ group: groupId }).populate('group', 'name');
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy tất cả danh mục
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().populate('group', 'name description');
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
