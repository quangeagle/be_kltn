
const mongoose = require('mongoose');

const predictedSalesSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  
  weekStart: { type: Date, required: true },
  weekIndex: { type: Number, required: true },
  year: { type: Number, required: true },
  weekOfYear: { type: Number, required: true },
  month: { type: Number, required: true },

  actualSales: { type: Number, required: true },      
  predictedSales: { type: Number, required: true },    
  modelUsed: { type: String, default: 'GRU' },        
  
  createdAt: { type: Date, default: Date.now }
});
  
module.exports = mongoose.model('PredictedSalesResult', predictedSalesSchema);
