const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  floors: { type: Number, default: 1 },
  mapId: { type: String },
  isDemo: { type: Boolean, default: false },
  graphData: { type: mongoose.Schema.Types.Mixed },
  bounds: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Building', buildingSchema);
