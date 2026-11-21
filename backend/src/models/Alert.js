const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: { type: String, enum: ['FIRE', 'SMOKE', 'CROWD', 'ROUTE_BLOCKED', 'REROUTED', 'INFO'], required: true },
  severity: { type: String, enum: ['INFO', 'WARNING', 'HIGH', 'CRITICAL'], required: true },
  message: { type: String, required: true },
  location: { type: String },
  cameraId: { type: String },
  nodeId: { type: String },
  timestamp: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
});

module.exports = mongoose.model('Alert', alertSchema);
