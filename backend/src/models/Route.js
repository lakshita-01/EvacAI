const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  mapId: { type: String, required: true },
  startNode: { type: String, required: true },
  exitNode: { type: String },
  route: [{ type: String }],
  distance: { type: Number },
  risk: { type: String },
  rerouted: { type: Boolean, default: false },
  blockedNodes: [{ type: String }],
  reason: { type: String },
  algorithm: { type: String, default: 'astar' },
  generatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Route', routeSchema);
