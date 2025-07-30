const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    unit: { type: String, required: true },
    quantity: { type: Number, default: 0 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    categoryGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'CategoryGroup', required: true },  // <-- Thay vì 'category'
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }, // optional
    images: [String],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'outOfStock'],
      default: 'pending'
    },
  
    createdAt: { type: Date, default: Date.now }
  });
  module.exports = mongoose.model('Product', productSchema);