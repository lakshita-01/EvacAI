const Camera = require('../models/Camera');

async function list(req, res, next) {
  try {
    const cameras = await Camera.find();
    res.json(cameras);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const camera = await Camera.create(req.body);
    res.status(201).json(camera);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const camera = await Camera.findOneAndUpdate(
      { cameraId: req.params.id },
      req.body,
      { new: true }
    );
    if (!camera) return res.status(404).json({ error: 'Camera not found' });
    res.json(camera);
  } catch (err) { next(err); }
}

async function seedDemoCameras(req, res, next) {
  try {
    const demoCameras = [
      { cameraId: 'CAM-01', mapId: 'DEMO-MAP-001', nodeId: 'CORR-A',   name: 'Corridor A Camera', floor: 1 },
      { cameraId: 'CAM-02', mapId: 'DEMO-MAP-001', nodeId: 'ROOM-A',   name: 'Room A Camera',     floor: 1 },
      { cameraId: 'CAM-03', mapId: 'DEMO-MAP-001', nodeId: 'ROOM-B',   name: 'Room B Camera',     floor: 1 },
      { cameraId: 'CAM-04', mapId: 'DEMO-MAP-001', nodeId: 'JUNCTION', name: 'Junction Camera',   floor: 1 },
    ];
    for (const cam of demoCameras) {
      await Camera.findOneAndUpdate({ cameraId: cam.cameraId }, cam, { upsert: true });
    }
    res.json({ message: 'Demo cameras seeded', count: demoCameras.length });
  } catch (err) { next(err); }
}

module.exports = { list, create, update, seedDemoCameras };
