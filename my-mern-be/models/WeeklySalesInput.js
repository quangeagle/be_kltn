const mongoose = require('mongoose');

const weeklySalesInputSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  weekIndex: { type: Number, required: true },
  weekStart: { type: Date, required: true },
  year: { type: Number, required: true },
  weekOfYear: { type: Number, required: true },
  month: { type: Number, required: true },
  weeklySales: { type: Number, required: true },
  holidayFlag: { type: Number, enum: [0, 1], required: true },
  temperature: { type: Number, required: true },
  fuelPrice: { type: Number, required: true },
  cpi: { type: Number, required: true },
  unemployment: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WeeklySalesInput', weeklySalesInputSchema);

