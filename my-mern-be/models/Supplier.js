const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  storeName: { type: String, required: true },
  ownerName: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  storeAddress: String,
  avatar: { type: String }, // Thêm trường ảnh đại diện
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Supplier', supplierSchema);
