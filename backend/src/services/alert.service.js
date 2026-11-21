const Alert = require('../models/Alert');

async function createAlert(io, { type, severity, message, location, cameraId, nodeId }) {
  const alert = await Alert.create({ type, severity, message, location, cameraId, nodeId });
  // Broadcast via Socket.IO
  if (io) io.emit('alert', alert);
  return alert;
}

async function resolveAlert(id) {
  return Alert.findByIdAndUpdate(id, { resolved: true, resolvedAt: new Date() }, { new: true });
}

module.exports = { createAlert, resolveAlert };
