require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

const aiRoutes       = require('./routes/ai.routes');
const mapRoutes      = require('./routes/map.routes');
const cameraRoutes   = require('./routes/camera.routes');
const analysisRoutes = require('./routes/analysis.routes');
const routeRoutes    = require('./routes/route.routes');
const alertRoutes    = require('./routes/alert.routes');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.set('io', io);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '8mb' }));

app.use('/api/ai',       aiRoutes);
app.use('/api/maps',     mapRoutes);
app.use('/api/cameras',  cameraRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/routes',   routeRoutes);
app.use('/api/alerts',   alertRoutes);

app.get('/', (req, res) => res.json({ service: 'evac-ai-backend', status: 'running', version: '1.0.0' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
});

const PORT = process.env.PORT || 3001;

connectDB().then(() => {
  server.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
});

module.exports = { app, server };
