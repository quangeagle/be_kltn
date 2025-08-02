const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Category = require('../models/Category');
const CategoryGroup = require('../models/CategoryGroup');
const cloudinary = require('../utils/cloudinary');
const upload = require('../middleware/upload');
// Supplier tạo sản phẩm mới

exports.createProduct = async (req, res) => {
  try {
    const supplierId = req.user.id;
    const { name, description, price, unit, quantity, category } = req.body;

    // 🔍 Lấy group từ category
    const foundCategory = await Category.findById(category).populate('group');
    if (!foundCategory) {
      return res.status(404).json({ error: 'Category không tồn tại' });
    }
    const categoryGroupId = foundCategory.group._id;

    // 📤 Upload ảnh lên Cloudinary
    let uploadedImageUrls = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file =>
        cloudinary.uploader.upload_stream({ folder: 'products' }, (error, result) => {
          if (error) throw error;
          uploadedImageUrls.push(result.secure_url);
        }).end(file.buffer)
      );

      await Promise.all(uploadPromises);
    }

    const newProduct = new Product({
      name,
      description,
      price,
      unit,
      quantity,
      category,
      categoryGroup: categoryGroupId,
      supplier: supplierId,
      images: uploadedImageUrls,
      status: 'pending'
    });

    const savedProduct = await newProduct.save();

    await Supplier.findByIdAndUpdate(supplierId, {
      $push: { products: savedProduct._id }
    });

    res.status(201).json({
      message: 'Product created and pending approval',
      product: savedProduct
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

  

// Admin duyệt sản phẩm
exports.approveProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const updated = await Product.findByIdAndUpdate(
      productId,
      { status: 'approved' },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Product not found' });

    res.json({ message: 'Product approved', product: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin từ chối sản phẩm
exports.rejectProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const updated = await Product.findByIdAndUpdate(
      productId,
      { status: 'rejected' },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Product not found' });

    res.json({ message: 'Product rejected', product: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.getProductDetail = async (req, res) => {
    try {
      const { id } = req.params;
      const product = await Product.findById(id).populate('categoryGroup').populate('supplier');
  
      if (!product || product.status !== 'approved') {
        return res.status(404).json({ error: 'Product not available' });
      }
  
      res.json({ product });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  exports.updateProduct = async (req, res) => {
    try {
      const supplierId = req.user.id;
      const productId = req.params.id;
  
      const product = await Product.findById(productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      if (product.supplier.toString() !== supplierId) return res.status(403).json({ error: 'Not your product' });
  
      const { name, description, price, unit, quantity, categoryGroup, category } = req.body;
  
      // 📤 Nếu có ảnh mới, upload lên Cloudinary
      let newImageUrls = product.images;
      if (req.files && req.files.length > 0) {
        const uploadPromises = req.files.map(file =>
          cloudinary.uploader.upload_stream({ folder: 'products' }, (error, result) => {
            if (error) throw error;
            newImageUrls.push(result.secure_url);
          }).end(file.buffer)
        );
        await Promise.all(uploadPromises);
      }
  
      // cập nhật lại dữ liệu
      product.name = name ?? product.name;
      product.description = description ?? product.description;
      product.price = price ?? product.price;
      product.unit = unit ?? product.unit;
      product.quantity = quantity ?? product.quantity;
      product.categoryGroup = categoryGroup ?? product.categoryGroup;
      product.category = category ?? product.category;
      product.images = newImageUrls;
      product.status = 'pending';
  
      const updated = await product.save();
      res.json({ message: 'Product updated, waiting for approval', product: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  
  // GET /products/supplier/:supplierId?status=pending|approved|rejected
exports.getProductsBySupplierAndStatus = async (req, res) => {
    try {
      const { supplierId } = req.params;
      const { status } = req.query;
  
      const query = { supplier: supplierId };
      if (status) query.status = status;
  
      const products = await Product.find(query)
        .populate('categoryGroup')
        .populate('supplier');
  
      res.json({ products });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  exports.getProductsByCategory = async (req, res) => {
    try {
      const { categoryId } = req.params;
      const products = await Product.find({ category: categoryId })
        .populate('categoryGroup')
        .populate('supplier');
  
      res.json({ products });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  exports.getApprovedProductsByCategory = async (req, res) => {
    try {
      const { categoryId } = req.params;
      const products = await Product.find({
        category: categoryId,
        status: 'approved'
      }).populate('categoryGroup').populate('supplier');
  
      res.json({ products });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  
  exports.getAllApprovedProducts = async (req, res) => {
    try {
      const products = await Product.find({ status: 'approved' })
        .populate('categoryGroup')
        .populate('supplier');
  
      res.json({ products });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  exports.getApprovedProductsBySupplier = async (req, res) => {
    try {
      const { supplierId } = req.params;
      const products = await Product.find({
        supplier: supplierId,
        status: 'approved'
      }).populate('categoryGroup').populate('supplier');
  
      res.json({ products });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  