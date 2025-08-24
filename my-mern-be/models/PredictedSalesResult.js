const mongoose = require('mongoose');

const predictedSalesSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },

  weekStart: { type: Date, required: true },
  weekIndex: { type: Number, required: true },
  year: { type: Number, required: true },
  weekOfYear: { type: Number, required: true },
  month: { type: Number, required: true },

  actualSales: { type: Number, required: true },

  // 🔹 Mảng chứa kết quả dự đoán từ nhiều model
  predictions: [
    {
      modelUsed: { type: String, enum: ['GRU', 'XGB'], required: true },
      predictedSales: { type: Number, required: true },
      logs: { type: mongoose.Schema.Types.Mixed, default: null },   // log GRU
      featureImportance: { type: mongoose.Schema.Types.Mixed, default: null } // SHAP XGB
    }
  ],

  source: { type: String, enum: ['dataset', 'realtime'], default: 'realtime' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PredictedSalesResult', predictedSalesSchema);
