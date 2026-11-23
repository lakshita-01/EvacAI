const {
  analyzeFrame, getMap, calculateRoute, reroute, resetAllHazards,
} = require('../services/external.service');
const { createAlert } = require('../services/alert.service');
const Detection = require('../models/Detection');
const Camera = require('../models/Camera');
const Route = require('../models/Route');

async function getCurrent(req, res, next) {
  try {
    const latest = await Detection.find().sort('-timestamp').limit(10);
    res.json(latest);
  } catch (err) { next(err); }
}

async function simulate(req, res, next) {
  try {
    const { scenario, mapId, nodeId, startNode, riskLevel } = req.body;
    const io = req.app.get('io');
    const activeMapId = mapId || 'DEMO-MAP-001';

    // Simulation scenarios — clearly labelled as demo/simulation
    const scenarios = {
      normal:          { cameraId: 'CAM-01', nodeId: 'CORR-A',   startNode: 'ROOM-A',   riskLevel: 'LOW',      fire: false, smoke: false },
      fire_room_a:     { cameraId: 'CAM-02', nodeId: 'ROOM-A',   startNode: 'ROOM-A',   riskLevel: 'CRITICAL', fire: true,  smoke: true  },
      smoke_corridor:  { cameraId: 'CAM-01', nodeId: 'CORR-A',  startNode: 'CORR-A',  riskLevel: 'HIGH',     fire: false, smoke: true  },
      crowd_room_b:    { cameraId: 'CAM-03', nodeId: 'ROOM-B',  startNode: 'ROOM-B',  riskLevel: 'MODERATE', fire: false, smoke: false },
      fire_junction:   { cameraId: 'CAM-04', nodeId: 'JUNCTION', startNode: 'JUNCTION', riskLevel: 'CRITICAL', fire: true,  smoke: true  },
    };

    const preset = scenarios[scenario];
    let sim = preset;
    if (!sim && ['fire', 'smoke', 'crowd', 'blocked', 'custom'].includes(scenario)) {
      if (!nodeId) return res.status(400).json({ error: 'nodeId is required for map-based simulations' });
      const mapData = await getMap(activeMapId);
      if (!mapData.nodes?.[nodeId]) {
        return res.status(400).json({ error: `Unknown simulation area: ${nodeId}` });
      }

      const dynamicScenarios = {
        fire: { riskLevel: 'CRITICAL', fire: true, smoke: true },
        smoke: { riskLevel: 'HIGH', fire: false, smoke: true },
        crowd: { riskLevel: 'MODERATE', fire: false, smoke: false },
        blocked: { riskLevel: 'CRITICAL', fire: false, smoke: false },
      };
      sim = {
        cameraId: 'USER-MARKED',
        nodeId,
        startNode,
        ...(scenario === 'custom'
          ? {
              riskLevel: String(riskLevel || '').toUpperCase(),
              fire: false,
              smoke: false,
            }
          : dynamicScenarios[scenario]),
      };
      if (!['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].includes(sim.riskLevel)) {
        return res.status(400).json({ error: 'riskLevel must be LOW, MODERATE, HIGH, or CRITICAL' });
      }
      if (!['LOW', 'MODERATE'].includes(sim.riskLevel) && mapData.nodes[nodeId].type === 'exit' && scenario !== 'blocked' && scenario !== 'custom') {
        return res.status(400).json({ error: 'Fire and smoke scenarios must target a non-exit area' });
      }
    }

    if (!sim) return res.status(400).json({ error: `Unknown scenario: ${scenario}` });

    const mapData = await getMap(activeMapId);
    if (scenario === 'normal' && activeMapId !== 'DEMO-MAP-001') {
      sim = {
        cameraId: 'USER-MARKED',
        nodeId: nodeId || startNode || Object.keys(mapData.nodes)[0],
        startNode,
        riskLevel: 'LOW',
        fire: false,
        smoke: false,
      };
    }
    const activeStart = startNode || sim.startNode ||
      Object.values(mapData.nodes).find(node => node.type === 'room')?.id ||
      Object.keys(mapData.nodes)[0];
    if (!activeStart || !mapData.nodes[activeStart]) {
      return res.status(400).json({ error: 'Choose a valid evacuation start area' });
    }
    if (scenario === 'normal' && activeMapId !== 'DEMO-MAP-001') {
      sim.nodeId = activeStart;
    }

    await resetAllHazards(activeMapId);

    const routeResult = scenario === 'normal'
      ? await calculateRoute(activeMapId, activeStart)
      : await reroute(activeMapId, sim.cameraId, sim.nodeId, sim.riskLevel, activeStart);

    // Save detection record
    const detection = await Detection.create({
      cameraId: sim.cameraId,
      nodeId: sim.nodeId,
      fireDetected: sim.fire,
      smokeDetected: sim.smoke,
      riskLevel: sim.riskLevel,
      rawResult: { simulation: true, scenario },
    });

    // Save route
    if (routeResult.route) {
      await Route.create({
        mapId: activeMapId,
        startNode: activeStart,
        exitNode: routeResult.exitNode,
        route: routeResult.route,
        distance: routeResult.distance,
        risk: routeResult.risk,
        rerouted: routeResult.rerouted || false,
        blockedNodes: routeResult.blockedNode ? [routeResult.blockedNode] : [],
        reason: routeResult.reason,
      });
    }

    // Create alerts
    if (sim.fire) {
      await createAlert(io, {
        type: 'FIRE', severity: 'CRITICAL',
        message: `🔥 Fire detected at ${sim.nodeId} via ${sim.cameraId}`,
        location: sim.nodeId, cameraId: sim.cameraId, nodeId: sim.nodeId,
      });
    }
    if (sim.smoke) {
      await createAlert(io, {
        type: 'SMOKE', severity: 'HIGH',
        message: `💨 Smoke detected at ${sim.nodeId} via ${sim.cameraId}`,
        location: sim.nodeId, cameraId: sim.cameraId, nodeId: sim.nodeId,
      });
    }
    if (scenario === 'crowd') {
      await createAlert(io, {
        type: 'CROWD', severity: 'WARNING',
        message: `👥 High crowd density simulated at ${sim.nodeId}`,
        location: sim.nodeId, cameraId: sim.cameraId, nodeId: sim.nodeId,
      });
    }
    if (scenario === 'blocked' || (scenario === 'custom' && sim.riskLevel === 'CRITICAL')) {
      await createAlert(io, {
        type: 'ROUTE_BLOCKED', severity: 'HIGH',
        message: `⛔ ${sim.nodeId} marked as blocked for this simulation`,
        location: sim.nodeId, cameraId: sim.cameraId, nodeId: sim.nodeId,
      });
    }
    if (routeResult.rerouted) {
      const destinationType = routeResult.destinationType === 'stairs' ? 'stairs' : 'exit';
      await createAlert(io, {
        type: 'REROUTED', severity: 'HIGH',
        message: `🚨 Route blocked at ${sim.nodeId}. New route to ${destinationType} ${routeResult.exitNode}.`,
        location: sim.nodeId, cameraId: sim.cameraId, nodeId: sim.nodeId,
      });
    }

    // Broadcast full state update via Socket.IO
    if (io) {
      io.emit('stateUpdate', {
        type: 'SIMULATION',
        scenario,
        detection,
        route: routeResult,
        mapId: activeMapId,
      });
    }

    res.json({ scenario, detection, route: routeResult });
  } catch (err) { next(err); }
}

async function processLiveFrame(req, res, next) {
  try {
    const io = req.app.get('io');
    const { camera_id = 'unknown', room_capacity = '50', node_id, map_id, start_node } = req.body;

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Look up which map node this camera covers
    const camera = await Camera.findOne({ cameraId: camera_id });
    const nodeId    = node_id || camera?.nodeId || 'CORR-A';
    const mapId     = map_id || camera?.mapId || 'DEMO-MAP-001';
    const startNode = start_node || 'ROOM-A';

    // Run YOLO analysis via ai-service
    const result = await analyzeFrame(
      req.file.buffer,
      'frame.jpg',
      camera_id,
      parseInt(room_capacity, 10),
    );

    // Persist detection
    const detection = await Detection.create({
      cameraId: camera_id,
      nodeId,
      fireDetected:  result.fireSmoke.fireDetected,
      smokeDetected: result.fireSmoke.smokeDetected,
      riskLevel:     result.risk.level.toUpperCase(),
      rawResult:     result,
    });

    const riskLevel = result.risk.level.toUpperCase();
    let routeResult = null;

    // Reroute if risk is HIGH or CRITICAL
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      routeResult = await reroute(mapId, camera_id, nodeId, riskLevel, startNode);

      if (routeResult?.route) {
        await Route.create({
          mapId,
          startNode,
          exitNode:     routeResult.exitNode,
          route:        routeResult.route,
          distance:     routeResult.distance,
          risk:         routeResult.risk,
          rerouted:     routeResult.rerouted || false,
          blockedNodes: routeResult.blockedNode ? [routeResult.blockedNode] : [],
          reason:       routeResult.reason,
        });
      }
    }

    // Fire alert
    if (result.fireSmoke.fireDetected) {
      await createAlert(io, {
        type: 'FIRE', severity: 'CRITICAL',
        message: `🔥 Fire detected at ${nodeId} via ${camera_id}`,
        location: nodeId, cameraId: camera_id, nodeId,
      });
    }

    // Smoke alert
    if (result.fireSmoke.smokeDetected) {
      await createAlert(io, {
        type: 'SMOKE', severity: 'HIGH',
        message: `💨 Smoke detected at ${nodeId} via ${camera_id}`,
        location: nodeId, cameraId: camera_id, nodeId,
      });
    }

    // Reroute alert
    if (routeResult?.rerouted) {
      const destinationType = routeResult.destinationType === 'stairs' ? 'stairs' : 'exit';
      await createAlert(io, {
        type: 'REROUTED', severity: 'HIGH',
        message: `🚨 Route blocked at ${nodeId}. New route to ${destinationType} ${routeResult.exitNode}.`,
        location: nodeId, cameraId: camera_id, nodeId,
      });
    }

    // Broadcast live state update
    if (io) {
      io.emit('stateUpdate', {
        type:      'LIVE',
        cameraId:  camera_id,
        detection,
        route:     routeResult,
        mapId,
      });
    }

    res.json({ ...result, detection, route: routeResult });
  } catch (err) { next(err); }
}

module.exports = { getCurrent, simulate, processLiveFrame };
