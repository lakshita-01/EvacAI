import { useState } from 'react';
import { useEvacSystem } from '../hooks/useEvacSystem';
import FloorMap from '../components/map/FloorMap';
import AlertPanel from '../components/alerts/AlertPanel';
import StatsPanel from '../components/stats/StatsPanel';
import SimulationControls from '../components/controls/SimulationControls';
import MapControls from '../components/controls/MapControls';
import MapUploadControl from '../components/map/MapUploadControl';
import { resolveAll } from '../services/api';

export default function Dashboard() {
  const {
    mapData, route, alerts, loading, error, simResult, runSimulation, reset, setAlerts, activateMap,
    liveActive, liveCamera, setLiveCamera, toggleLive, liveStatus,
  } = useEvacSystem();
  const [mapControls, setMapControls] = useState({
    showHeatmap: true, showRoute: true, showExits: true, showCameras: true, showLabels: true,
  });
  const [simLoading, setSimLoading] = useState(false);

  const rawRisk = (simResult?.detection?.riskLevel || simResult?.route?.risk || route?.risk || 'normal').toLowerCase();
  const currentRisk = rawRisk === 'low' ? 'normal' : rawRisk;
  const destinationType = mapData?.nodes?.[route?.exitNode]?.type || route?.destinationType;
  const destinationLabel = destinationType === 'stairs' ? 'Stairs' : 'Exit';

  async function handleSimulate(scenario, nodeId, riskLevel, startNode) {
    setSimLoading(true);
    try {
      await runSimulation(scenario, nodeId, riskLevel, startNode);
    } finally {
      setSimLoading(false);
    }
  }

  async function handleReset() {
    await reset();
  }

  async function handleResolveAll() {
    await resolveAll();
    setAlerts([]);
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-card">
        <strong>EVAC-AI INITIALIZING</strong>
        <span>Connecting to building services</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="error-screen">
      <div className="error-card">
        <strong>SERVICE ERROR</strong>
        <span>{error}</span>
        <small>Verify backend port 3001 and map service port 8001</small>
      </div>
    </div>
  );

  return (
    <div className="app-shell">

      {/* ── Header ── */}
      <header className="command-header">
        <div className="header-brand">
          <span className="brand-mark" aria-hidden="true">EV</span>
          <div>
            <h1>EVAC-AI</h1>
            <p>Emergency Evacuation Management System</p>
          </div>
        </div>
        <div className="header-status">
          {route?.rerouted && (
            <span className="header-chip reroute-chip">ROUTE REROUTED</span>
          )}
          <span className={`risk-chip ${currentRisk}`}>
            RISK: {currentRisk.toUpperCase()}
          </span>
          <span className="header-chip">
            {mapData?.isDemo ? 'DEMO MAP' : mapData?.sourceType === 'image' ? 'IMAGE PLAN' : 'CAD MAP'}
          </span>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="operations-grid">

        {/* ── Left sidebar ── */}
        <aside className="support-rail">
          <StatsPanel route={route} simResult={simResult} mapData={mapData} />
          <MapControls controls={mapControls} onChange={(k, v) => setMapControls(p => ({ ...p, [k]: v }))} />
          <section className="map-import-panel panel" aria-label="Building floor plan">
            <div className="map-import-heading">
              <h3 className="panel-heading">Building plan</h3>
              <span>DXF · PNG · JPG</span>
            </div>
            <MapUploadControl onActivateMap={activateMap} />
          </section>
        </aside>

        {/* ── Floor map (center) ── */}
        <main className="map-column">
          <div className="map-toolbar panel">
            <h2 className="map-title">
              Floor map / {mapData?.isDemo
                ? 'Demo Building'
                : mapData?.sourceType === 'image'
                  ? 'Uploaded Plan'
                  : `CAD Map ${mapData?.mapId}`}
            </h2>
            {route?.route ? (
              <div className="route-chain">
                Route: {route.route?.join(' → ')}
              </div>
            ) : mapData ? (
              <div className="route-chain" style={{ color: '#f87171' }}>
                No safe route available
              </div>
            ) : (
              null
            )}
          </div>
          <div className="map-frame">
            <FloorMap mapData={mapData} route={route} showControls={mapControls} mapImage={mapData?.imageData} />
          </div>

          {/* Route info bar */}
          {route && (
            <div className={`route-info ${route.rerouted ? 'rerouted' : ''}`}>
              <span className="status-dot" />
              <span><strong>{route.rerouted ? 'REROUTED' : 'ACTIVE ROUTE'}</strong></span>
              <span>Start: <strong>{route.startNode}</strong></span>
              <span>{destinationLabel}: <strong>{route.exitNode}</strong></span>
              <span>Distance: <strong>{route.distance}m</strong></span>
              {route.rerouted && <span>Blocked: <strong className="text-red-400">{simResult?.route?.blockedNode}</strong></span>}
            </div>
          )}
        </main>

        {/* ── Right sidebar ── */}
        <aside className="right-rail">
          <SimulationControls
            onSimulate={handleSimulate} onReset={handleReset} loading={simLoading}
            liveActive={liveActive} liveCamera={liveCamera}
            onLiveCameraChange={setLiveCamera} onLiveToggle={toggleLive}
            liveStatus={liveStatus} mapData={mapData}
          />
          <div className="flex-1 min-h-0">
            <AlertPanel alerts={alerts} onResolveAll={handleResolveAll} />
          </div>
        </aside>

      </div>
    </div>
  );
}
