const mongoose = require('mongoose');

const cameraSchema = new mongoose.Schema({
  cameraId: { type: String, required: true, unique: true },
  buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building' },
  mapId: { type: String },
  floor: { type: Number, default: 1 },
  nodeId: { type: String, required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive', 'error'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Camera', cameraSchema);
