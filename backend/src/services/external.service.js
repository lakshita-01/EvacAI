const axios = require('axios');
const FormData = require('form-data');

const AI_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const MAP_URL = process.env.MAP_SERVICE_URL || 'http://127.0.0.1:8001';

const aiClient = axios.create({ baseURL: AI_URL, timeout: 30000 });
const mapClient = axios.create({ baseURL: MAP_URL, timeout: 10000 });

async function analyzeFrame(fileBuffer, filename, cameraId, roomCapacity = 50) {
  const form = new FormData();
  form.append('file', fileBuffer, { filename: filename || 'frame.jpg' });
  form.append('camera_id', cameraId);
  form.append('room_capacity', String(roomCapacity));
  const res = await aiClient.post('/api/analyze/frame', form, { headers: form.getHeaders() });
  return res.data;
}

async function getAIHealth() {
  const res = await aiClient.get('/api/health');
  return res.data;
}

async function getDemoMap() {
  const res = await mapClient.get('/api/maps/demo');
  return res.data;
}

async function getMap(mapId) {
  const res = await mapClient.get(`/api/maps/${mapId}`);
  return res.data;
}

async function uploadDxf(buffer, filename) {
  const form = new FormData();
  form.append('file', buffer, { filename });
  const res = await mapClient.post('/api/maps/upload', form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });
  return res.data;
}

async function createDraftMap(graph) {
  const res = await mapClient.post('/api/maps/draft', graph);
  return res.data;
}

async function calculateRoute(mapId, startNode, algorithm = 'astar') {
  const res = await mapClient.post('/api/routes/calculate', { mapId, startNode, algorithm });
  return res.data;
}

async function reroute(mapId, cameraId, nodeId, riskLevel, startNode) {
  const res = await mapClient.post('/api/routes/reroute', { mapId, cameraId, nodeId, riskLevel, startNode });
  return res.data;
}

async function resetHazard(mapId, nodeId) {
  const res = await mapClient.post('/api/routes/reset-hazard', { mapId, nodeId });
  return res.data;
}

async function resetAllHazards(mapId) {
  const res = await mapClient.post('/api/routes/reset-all', { mapId });
  return res.data;
}

async function getMapHealth() {
  const res = await mapClient.get('/api/health');
  return res.data;
}

module.exports = {
  analyzeFrame, getAIHealth, getDemoMap, getMap, uploadDxf, createDraftMap,
  calculateRoute, reroute, resetHazard, resetAllHazards, getMapHealth,
};
