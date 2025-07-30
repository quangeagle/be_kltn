const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'CategoryGroup', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
