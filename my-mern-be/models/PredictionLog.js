const mongoose = require('mongoose');

const predictionLogSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },

  weekStart: { type: Date, required: true },
  weekOfYear: { type: Number, default: null },
  year: { type: Number, default: null },

  predictedByXGB: { type: Number, default: null },
  predictedByGRU: { type: Number, default: null },

  actualWeeklySales: { type: Number, default: 0 },
  predictions: [
    {
      modelUsed: { type: String, enum: ['GRU', 'XGB'], required: true },
      predictedSales: { type: Number, required: true },
      confidenceScore: { type: Number, default: null },
      trend: { type: String, default: null },
      logs: { type: mongoose.Schema.Types.Mixed, default: null },
      featureImportance: { type: mongoose.Schema.Types.Mixed, default: null }
    }
  ],

  externalFactorsCurrent: {
    holidayFlag: { type: Number, enum: [0,1], default: null },
    temperature: { type: Number, default: null },
    fuelPrice: { type: Number, default: null },
    cpi: { type: Number, default: null },    
    unemployment: { type: Number, default: null },
    month: { type: Number, default: null },
    weekOfYear: { type: Number, default: null },
    year: { type: Number, default: null },
    dayOfWeek: { type: Number, default: null },
    isWeekend: { type: Number, enum: [0,1], default: null }
  }
}, { timestamps: true });

module.exports = mongoose.model('PredictionLog', predictionLogSchema);
