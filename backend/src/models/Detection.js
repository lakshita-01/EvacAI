const mongoose = require('mongoose');

const detectionSchema = new mongoose.Schema({
  cameraId: { type: String, required: true },
  nodeId: { type: String },
  timestamp: { type: Date, default: Date.now },
  peopleCount: { type: Number, default: 0 },
  fireDetected: { type: Boolean, default: false },
  fireConfidence: { type: Number, default: 0 },
  smokeDetected: { type: Boolean, default: false },
  smokeConfidence: { type: Number, default: 0 },
  density: { type: Number, default: 0 },
  densityLevel: { type: String, default: 'LOW' },
  riskScore: { type: Number, default: 0 },
  riskLevel: { type: String, default: 'LOW' },
  rawResult: { type: mongoose.Schema.Types.Mixed },
});

module.exports = mongoose.model('Detection', detectionSchema);
