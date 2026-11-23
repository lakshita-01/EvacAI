const { getDemoMap, getMap, uploadDxf, createDraftMap, updateDraftMap, restoreMap } = require('../services/external.service');
const Building = require('../models/Building');

function forwardMapServiceError(err, next) {
  if (err.response) {
    const detail = err.response.data?.detail || err.response.data?.error;
    err.status = err.response.status;
    if (detail) err.message = typeof detail === 'string' ? detail : JSON.stringify(detail);
  }
  next(err);
}

async function upload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Select a DXF file to upload' });
    if (!req.file.originalname.toLowerCase().endsWith('.dxf')) {
      return res.status(400).json({ error: 'Only .dxf files are supported for CAD upload' });
    }

    const mapData = await uploadDxf(req.file.buffer, req.file.originalname);
    await Building.findOneAndUpdate(
      { mapId: mapData.mapId },
      { name: req.file.originalname, mapId: mapData.mapId, isDemo: false, graphData: mapData },
      { upsert: true, new: true }
    );
    res.status(201).json({ mapData });
  } catch (err) {
    forwardMapServiceError(err, next);
  }
}

async function createDraft(req, res, next) {
  try {
    const mapData = await createDraftMap(req.body);
    await Building.findOneAndUpdate(
      { mapId: mapData.mapId },
      { name: 'Uploaded floor plan', mapId: mapData.mapId, isDemo: false, graphData: mapData },
      { upsert: true, new: true }
    );
    res.status(201).json({ mapData });
  } catch (err) {
    forwardMapServiceError(err, next);
  }
}

async function updateDraft(req, res, next) {
  try {
    const building = await Building.findOne({ mapId: req.params.id });
    if (!building || building.graphData?.sourceType !== 'image') {
      return res.status(404).json({ error: 'Editable image map not found' });
    }

    const mapData = await updateDraftMap(req.params.id, req.body);
    building.graphData = mapData;
    await building.save();
    res.json({ mapData });
  } catch (err) {
    forwardMapServiceError(err, next);
  }
}

async function demo(req, res, next) {
  try {
    const mapData = await getDemoMap();
    // Upsert demo building in DB
    const building = await Building.findOneAndUpdate(
      { mapId: mapData.mapId },
      { name: 'Demo Building', mapId: mapData.mapId, isDemo: true, graphData: mapData },
      { upsert: true, new: true }
    );
    res.json({ building, mapData });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const mapData = await getMap(req.params.id);
    res.json(mapData);
  } catch (err) {
    if (err.response?.status === 404) {
      try {
        const building = await Building.findOne({ mapId: req.params.id });
        if (!building?.graphData) return res.status(404).json({ error: 'Map not found' });
        await restoreMap(building.graphData);
        return res.json(building.graphData);
      } catch (restoreError) {
        return next(restoreError);
      }
    }
    next(err);
  }
}

async function listBuildings(req, res, next) {
  try {
    const buildings = await Building.find().select('-graphData').sort('-createdAt');
    res.json(buildings);
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, createDraft, updateDraft, demo, getById, listBuildings };
