function errorHandler(err, req, res, next) {
  const status = err.status || err.response?.status || 500;
  const message = err.response?.data?.detail || err.message || 'Internal server error';
  console.error(`[ERROR] ${req.method} ${req.path} → ${status}: ${message}`);
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
