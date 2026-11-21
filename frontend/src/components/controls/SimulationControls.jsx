import { useEffect, useMemo, useState } from 'react';
import './SimulationControls.css';

const SCENARIOS = [
  { id: 'normal',         label: 'Normal',             icon: '✅', color: 'bg-green-900 hover:bg-green-800' },
  { id: 'fire_room_a',    label: 'Fire in Room A',      icon: '🔥', color: 'bg-red-900 hover:bg-red-800' },
  { id: 'smoke_corridor', label: 'Smoke in Corridor A', icon: '💨', color: 'bg-orange-900 hover:bg-orange-800' },
  { id: 'crowd_room_b',   label: 'High Crowd Room B',   icon: '👥', color: 'bg-yellow-900 hover:bg-yellow-800' },
  { id: 'fire_junction',  label: 'Fire at Junction',    icon: '🚨', color: 'bg-red-950 hover:bg-red-900' },
];

const CAMERAS = [
  { id: 'CAM-01', label: 'CAM-01 — Corridor A' },
  { id: 'CAM-02', label: 'CAM-02 — Room A' },
  { id: 'CAM-03', label: 'CAM-03 — Room B' },
  { id: 'CAM-04', label: 'CAM-04 — Junction' },
];

export default function SimulationControls({
  onSimulate, onReset, loading,
  liveActive, liveCamera, onLiveCameraChange, onLiveToggle, liveStatus,
  mapData,
}) {
  const nodes = useMemo(() => Object.values(mapData?.nodes || {}), [mapData?.nodes]);
  const targetNodes = nodes.filter(node => node.type !== 'exit');
  const [targetNodeId, setTargetNodeId] = useState('');
  const [startNodeId, setStartNodeId] = useState('');
  const [customRisk, setCustomRisk] = useState('CRITICAL');

  useEffect(() => {
    if (!nodes.some(node => node.id === targetNodeId)) {
      setTargetNodeId((targetNodes[0] || nodes[0])?.id || '');
    }
    if (!nodes.some(node => node.id === startNodeId)) {
      setStartNodeId(nodes.find(node => node.type === 'room')?.id || nodes[0]?.id || '');
    }
  }, [mapData?.mapId, nodes, targetNodeId, startNodeId]);

  const selectedNode = nodes.find(node => node.id === targetNodeId);
  const selectedStart = nodes.find(node => node.id === startNodeId);
  const dynamicOptions = [
    { id: 'fire', label: 'Fire', icon: '🔥', nonExitOnly: true },
    { id: 'smoke', label: 'Smoke', icon: '💨', nonExitOnly: true },
    { id: 'crowd', label: 'High crowd', icon: '👥', nonExitOnly: true },
    { id: 'blocked', label: 'Block area', icon: '⛔', nonExitOnly: false },
  ];

  return (
    <div className="flex flex-col gap-3">

      {mapData?.isDemo && (
        <div className="live-panel">
          <h3 className="panel-heading">Live Camera</h3>
          <select
            value={liveCamera}
            onChange={e => onLiveCameraChange(e.target.value)}
            disabled={liveActive}
            className="live-select"
          >
            {CAMERAS.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button
            onClick={onLiveToggle}
            className={`live-toggle ${liveActive ? 'stop' : 'start'}`}
          >
            {liveActive ? 'Stop Live Feed' : 'Start Live Feed'}
          </button>
          {liveStatus && (
            <div className={`live-status ${liveStatus.startsWith('ERROR') ? 'error' : ''}`}>
              {liveStatus}
            </div>
          )}
        </div>
      )}

      {/* ── Simulation Panel ── */}
      <div className="control-panel">
        <h3 className="panel-heading">Simulation Mode</h3>
        <div className="scenario-grid">
          {SCENARIOS.filter(scenario => mapData?.isDemo || scenario.id === 'normal').map(s => (
            <button key={s.id}
              onClick={() => onSimulate(s.id, undefined, undefined, startNodeId)}
              disabled={loading || liveActive}
              className="simulation-button">
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
        <div className="map-simulation-builder">
          <h4>Simulate any area</h4>
          <label>
            Hazard location
            <select className="live-select" value={targetNodeId}
              onChange={event => setTargetNodeId(event.target.value)} disabled={!nodes.length}>
              {nodes.map(node => <option key={node.id} value={node.id}>{node.label || node.id} · {node.type}</option>)}
            </select>
          </label>
          <label>
            Evacuation starts at
            <select className="live-select" value={startNodeId}
              onChange={event => setStartNodeId(event.target.value)} disabled={!nodes.length}>
              {nodes.map(node => <option key={node.id} value={node.id}>{node.label || node.id}</option>)}
            </select>
          </label>
          <div className="scenario-grid">
            {dynamicOptions.map(option => (
              <button key={option.id}
                onClick={() => onSimulate(option.id, targetNodeId, undefined, startNodeId)}
                disabled={loading || liveActive || !selectedNode || !selectedStart ||
                  (option.nonExitOnly && selectedNode.type === 'exit')}
                className="simulation-button">
                <span>{option.icon}</span>
                <span>{option.label} at {selectedNode?.label || 'area'}</span>
              </button>
            ))}
          </div>
          <label>
            Custom hazard severity
            <select className="live-select" value={customRisk} onChange={event => setCustomRisk(event.target.value)}>
              <option value="MODERATE">Moderate</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical / blocked</option>
            </select>
          </label>
          <button className="simulation-button"
            onClick={() => onSimulate('custom', targetNodeId, customRisk, startNodeId)}
            disabled={loading || liveActive || !selectedNode || !selectedStart}>
            <span>⚙️</span><span>Apply custom hazard</span>
          </button>
        </div>
        <button onClick={onReset}
          disabled={liveActive}
          className="reset-button">
          Reset Simulation
        </button>
      </div>

    </div>
  );
}
