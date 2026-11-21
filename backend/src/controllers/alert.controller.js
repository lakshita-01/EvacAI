const Alert = require('../models/Alert');
const { resolveAlert } = require('../services/alert.service');

async function list(req, res, next) {
  try {
    const filter = req.query.resolved === 'true' ? {} : { resolved: false };
    const alerts = await Alert.find(filter).sort('-timestamp').limit(50);
    res.json(alerts);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const io = req.app.get('io');
    const { createAlert } = require('../services/alert.service');
    const alert = await createAlert(io, req.body);
    res.status(201).json(alert);
  } catch (err) { next(err); }
}

async function resolve(req, res, next) {
  try {
    const alert = await resolveAlert(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) { next(err); }
}

async function resolveAll(req, res, next) {
  try {
    await Alert.updateMany({ resolved: false }, { resolved: true, resolvedAt: new Date() });
    res.json({ message: 'All alerts resolved' });
  } catch (err) { next(err); }
}

module.exports = { list, create, resolve, resolveAll };
