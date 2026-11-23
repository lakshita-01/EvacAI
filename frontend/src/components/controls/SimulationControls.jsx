import { useEffect, useMemo, useState } from 'react';
import './SimulationControls.css';

const CAMERAS = [
  { id: 'CAM-01', label: 'CAM-01 — Corridor A' },
  { id: 'CAM-02', label: 'CAM-02 — Room A' },
  { id: 'CAM-03', label: 'CAM-03 — Room B' },
  { id: 'CAM-04', label: 'CAM-04 — Junction' },
];

export default function SimulationControls({
  onSimulate, onReset, loading,
  liveActive, liveCamera, onLiveCameraChange, onLiveToggle, liveStatus,
  imageUploading, onCameraImageUpload,
  mapData,
}) {
  const nodes = useMemo(() => Object.values(mapData?.nodes || {}), [mapData?.nodes]);
  const rooms = nodes.filter(node => node.type === 'room');
  const cameraAreas = rooms.length ? rooms : nodes.filter(node => node.type !== 'exit');
  const roomCameras = cameraAreas
    .map(node => ({ cameraId: `CAM-${node.id}`, nodeId: node.id, name: `${node.label || node.id} Camera` }));
  const cameras = mapData?.cameras?.length
    ? mapData.cameras
    : mapData?.isDemo
      ? CAMERAS
      : roomCameras;
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

      {mapData && (
        <div className="live-panel">
          <h3 className="panel-heading">Live Camera</h3>
          {cameras.length === 0 && (
            <p className="live-camera-empty">Mark an area on this floor plan to assign a camera.</p>
          )}
          <select
            value={liveCamera}
            onChange={e => onLiveCameraChange(e.target.value)}
            disabled={liveActive || imageUploading || cameras.length === 0}
            className="live-select"
          >
            {cameras.map(camera => (
              <option key={camera.cameraId || camera.id} value={camera.cameraId || camera.id}>
                {camera.cameraId ? `${camera.cameraId} — ${camera.name}` : camera.label}
              </option>
            ))}
          </select>
          <button
            onClick={onLiveToggle}
            disabled={imageUploading || cameras.length === 0}
            className={`live-toggle ${liveActive ? 'stop' : 'start'}`}
          >
            {liveActive ? 'Stop Live Feed' : 'Start Live Feed'}
          </button>
          <label className={`camera-upload ${liveActive || imageUploading || cameras.length === 0 ? 'disabled' : ''}`}>
            <span>{imageUploading ? 'Analyzing image...' : 'Upload image for this camera'}</span>
            <input
              type="file"
              accept="image/*"
              disabled={liveActive || imageUploading || cameras.length === 0}
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) onCameraImageUpload(file);
                event.target.value = '';
              }}
            />
          </label>
          {liveStatus && (
            <div className={`live-status ${liveStatus.startsWith('ERROR') ? 'error' : ''}`}>
              {liveStatus}
            </div>
          )}
        </div>
      )}

      <div className="control-panel">
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
                disabled={loading || imageUploading || liveActive || !selectedNode || !selectedStart ||
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
            disabled={loading || imageUploading || liveActive || !selectedNode || !selectedStart}>
            <span>⚙️</span><span>Apply custom hazard</span>
          </button>
        </div>
        <button onClick={onReset}
          disabled={liveActive || imageUploading}
          className="reset-button">
          Reset Simulation
        </button>
      </div>

    </div>
  );
}
