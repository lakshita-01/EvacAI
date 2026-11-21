# Backend

Node.js/Express REST API with MongoDB and Socket.IO.

## Start
```bash
npm install
npm run dev
```

## Seed demo data (run once after starting)
```bash
curl -X POST http://localhost:3001/api/cameras/seed-demo
curl http://localhost:3001/api/maps/demo
```

## Key endpoints
- `GET  /api/ai/health`
- `GET  /api/maps/demo`
- `POST /api/analysis/simulate`  — Run simulation scenario
- `POST /api/routes/calculate`
- `GET  /api/alerts`
- `POST /api/alerts/resolve-all`
