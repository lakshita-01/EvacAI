const { calculateRoute, reroute, resetHazard, resetAllHazards } = require('../services/external.service');
const Route = require('../models/Route');

async function calculate(req, res, next) {
  try {
    const { mapId, startNode, algorithm } = req.body;
    if (!mapId || !startNode) return res.status(400).json({ error: 'mapId and startNode required' });
    const result = await calculateRoute(mapId, startNode, algorithm);
    const saved = await Route.create({ mapId, startNode, ...result });
    res.json(saved);
  } catch (err) { next(err); }
}

async function rerouteHandler(req, res, next) {
  try {
    const { mapId, cameraId, nodeId, riskLevel, startNode } = req.body;
    if (!mapId || !nodeId || !riskLevel) return res.status(400).json({ error: 'mapId, nodeId, riskLevel required' });
    const result = await reroute(mapId, cameraId, nodeId, riskLevel, startNode);
    res.json(result);
  } catch (err) { next(err); }
}

async function getCurrent(req, res, next) {
  try {
    const route = await Route.findOne().sort('-generatedAt');
    if (!route) return res.status(404).json({ error: 'No route found' });
    res.json(route);
  } catch (err) { next(err); }
}

async function reset(req, res, next) {
  try {
    const { mapId, nodeId } = req.body;
    const result = await resetHazard(mapId, nodeId);
    res.json(result);
  } catch (err) { next(err); }
}

async function resetAll(req, res, next) {
  try {
    const { mapId } = req.body;
    if (!mapId) return res.status(400).json({ error: 'mapId required' });
    const result = await resetAllHazards(mapId);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { calculate, rerouteHandler, getCurrent, reset, resetAll };
