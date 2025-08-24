const mongoose = require('mongoose');

const weeklyItemSchema = new mongoose.Schema({
  weekIndex: { type: Number, required: true },
  weekStart: { type: Date, required: true },
  year: { type: Number, required: true },
  weekOfYear: { type: Number, required: true },
  month: { type: Number, required: true },
  weeklySales: { type: Number, required: true },
  holidayFlag: { type: Number, enum: [0, 1], required: true },
  temperature: { type: Number, required: false, default: null },
  fuelPrice: { type: Number, required: false, default: null },
  cpi: { type: Number, required: true },
  description: { type: String, required: false, default: null },
  unemployment: { type: Number, required: true }
}, { _id: false });

// Bảng test dataset
const weeklySalesTestInputSchema = new mongoose.Schema({
  items: { type: [weeklyItemSchema], required: true }, // không cần supplier
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WeeklySalesTestInput', weeklySalesTestInputSchema);
