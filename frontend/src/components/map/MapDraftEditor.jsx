import { useMemo, useRef, useState } from 'react';
import './MapDraftEditor.css';

const TYPES = [
  { value: 'room', label: 'Room' },
  { value: 'corridor', label: 'Corridor' },
  { value: 'junction', label: 'Junction' },
  { value: 'door', label: 'Door' },
  { value: 'stairs', label: 'Stairs' },
  { value: 'exit', label: 'Exit' },
];

const COLORS = {
  room: '#2563eb',
  corridor: '#475569',
  junction: '#0891b2',
  door: '#d97706',
  stairs: '#7c3aed',
  exit: '#16a34a',
};

function orientation(a, b, c) {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function crosses(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export default function MapDraftEditor({ imageData, onCancel, onCreate }) {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState('area');
  const [nodeType, setNodeType] = useState('room');
  const [newLabel, setNewLabel] = useState('');
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [walls, setWalls] = useState([]);
  const [connectFrom, setConnectFrom] = useState(null);
  const [wallStart, setWallStart] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const clearEdges = useMemo(() => edges.filter(edge => {
    const source = nodes.find(node => node.id === edge.source);
    const target = nodes.find(node => node.id === edge.target);
    if (!source || !target) return false;
    return !walls.some(wall => crosses(source, target, wall.start, wall.end));
  }), [edges, nodes, walls]);

  function pointFromEvent(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * 1200),
      y: Math.round(((event.clientY - rect.top) / rect.height) * 800),
    };
  }

  function handleCanvasClick(event) {
    const point = pointFromEvent(event);
    if (mode === 'area') {
      const count = nodes.filter(node => node.type === nodeType).length + 1;
      const typeLabel = TYPES.find(type => type.value === nodeType)?.label || 'Area';
      let nextIndex = 1;
      while (nodes.some(node => node.id === `N${String(nextIndex).padStart(2, '0')}`)) nextIndex += 1;
      const id = `N${String(nextIndex).padStart(2, '0')}`;
      setNodes(current => [...current, {
        id,
        type: nodeType,
        x: point.x,
        y: point.y,
        label: newLabel.trim() || `${typeLabel} ${count}`,
        capacity: 50,
      }]);
      setNewLabel('');
    } else if (mode === 'wall') {
      if (!wallStart) setWallStart(point);
      else {
        setWalls(current => [...current, { start: wallStart, end: point }]);
        setWallStart(null);
      }
    }
  }

  function handleNodeClick(event, nodeId) {
    if (mode === 'area') {
      event.stopPropagation();
      return;
    }
    if (mode !== 'connect') return;
    event.stopPropagation();
    if (!connectFrom) {
      setConnectFrom(nodeId);
      return;
    }
    if (connectFrom !== nodeId && !edges.some(edge =>
      (edge.source === connectFrom && edge.target === nodeId) ||
      (edge.source === nodeId && edge.target === connectFrom)
    )) {
      setEdges(current => [...current, { source: connectFrom, target: nodeId }]);
    }
    setConnectFrom(null);
  }

  function updateNode(nodeId, update) {
    setNodes(current => current.map(node => node.id === nodeId ? { ...node, ...update } : node));
  }

  function removeNode(nodeId) {
    setNodes(current => current.filter(node => node.id !== nodeId));
    setEdges(current => current.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
    if (connectFrom === nodeId) setConnectFrom(null);
  }

  async function submitDraft() {
    setError('');
    if (nodes.length < 2) {
      setError('Mark at least two areas on the plan.');
      return;
    }
    if (!nodes.some(node => node.type === 'exit')) {
      setError('Mark at least one exit before creating the map.');
      return;
    }
    if (!clearEdges.length) {
      setError('Connect areas that form a safe route to an exit.');
      return;
    }

    setSaving(true);
    try {
      await onCreate({
        nodes,
        edges: clearEdges,
        exits: nodes.filter(node => node.type === 'exit').map(node => node.id),
        walls: walls.map(wall => ({
          x1: wall.start.x, y1: wall.start.y, x2: wall.end.x, y2: wall.end.y,
        })),
        imageData,
      });
    } catch (submitError) {
      setError(submitError.message || 'Could not create the floor-plan draft.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="map-editor-backdrop" role="presentation">
      <section className="map-editor" role="dialog" aria-modal="true" aria-labelledby="map-editor-title">
        <header className="map-editor-header">
          <div>
            <p className="map-editor-eyebrow">FLOOR PLAN REVIEW</p>
            <h2 id="map-editor-title">Build a route-ready map</h2>
            <p>Mark areas on the image, connect walkable spaces, and outline walls.</p>
          </div>
          <button type="button" className="map-editor-close" onClick={onCancel} aria-label="Close map editor">×</button>
        </header>

        <div className="map-editor-body">
          <aside className="map-editor-tools">
            <div className="map-editor-mode-row" role="group" aria-label="Map editing tools">
              <button type="button" className={mode === 'area' ? 'selected' : ''} onClick={() => setMode('area')}>Mark area</button>
              <button type="button" className={mode === 'connect' ? 'selected' : ''} onClick={() => setMode('connect')}>Connect</button>
              <button type="button" className={mode === 'wall' ? 'selected' : ''} onClick={() => setMode('wall')}>Draw wall</button>
            </div>

            {mode === 'area' && (
              <div className="map-editor-form">
                <label>
                  Area type
                  <select value={nodeType} onChange={event => setNodeType(event.target.value)}>
                    {TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
                <label>
                  Label (optional)
                  <input value={newLabel} onChange={event => setNewLabel(event.target.value)} placeholder="e.g. North wing" />
                </label>
                <p>Click the plan to add an area. Set at least one area to Exit.</p>
              </div>
            )}
            {mode === 'connect' && (
              <p className="map-editor-help">
                {connectFrom ? 'Choose the connected area.' : 'Click two areas in sequence to connect them.'}
              </p>
            )}
            {mode === 'wall' && (
              <p className="map-editor-help">
                {wallStart ? 'Click the wall end point.' : 'Click two points to draw a wall. Crossed connections will be excluded.'}
              </p>
            )}

            <div className="map-editor-inventory">
              <div className="map-editor-inventory-heading">
                <strong>Marked areas</strong><span>{nodes.length}</span>
              </div>
              {nodes.length === 0 && <p className="map-editor-empty">No areas marked yet.</p>}
              {nodes.map(node => (
                <div className="map-editor-node" key={node.id}>
                  <span className="map-editor-node-dot" style={{ background: COLORS[node.type] }} />
                  <input
                    aria-label={`${node.id} label`}
                    value={node.label}
                    onChange={event => updateNode(node.id, { label: event.target.value })}
                  />
                  <select
                    aria-label={`${node.id} type`}
                    value={node.type}
                    onChange={event => updateNode(node.id, { type: event.target.value })}
                  >
                    {TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                  <button type="button" onClick={() => removeNode(node.id)} aria-label={`Remove ${node.label}`}>×</button>
                </div>
              ))}
              {edges.length > 0 && (
                <div className="map-editor-line-list">
                  <strong>Connections</strong>
                  {edges.map((edge, index) => (
                    <div key={`${edge.source}-${edge.target}-${index}`}>
                      <span>{nodes.find(node => node.id === edge.source)?.label || edge.source} ↔ {nodes.find(node => node.id === edge.target)?.label || edge.target}</span>
                      <button type="button" onClick={() => setEdges(current => current.filter((_, edgeIndex) => edgeIndex !== index))}
                        aria-label={`Remove connection ${edge.source} to ${edge.target}`}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {walls.length > 0 && (
                <div className="map-editor-line-list">
                  <strong>Walls</strong>
                  {walls.map((wall, index) => (
                    <div key={`wall-${index}`}>
                      <span>Wall {index + 1}</span>
                      <button type="button" onClick={() => setWalls(current => current.filter((_, wallIndex) => wallIndex !== index))}
                        aria-label={`Remove wall ${index + 1}`}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="map-editor-summary">
                <span>{clearEdges.length} walkable connections</span>
                <span>{walls.length} walls</span>
              </div>
            </div>
          </aside>

          <div className={`map-editor-canvas-wrap mode-${mode}`}>
            <svg
              ref={canvasRef}
              className="map-editor-canvas"
              viewBox="0 0 1200 800"
              preserveAspectRatio="none"
              onClick={handleCanvasClick}
              aria-label="Uploaded floor plan editor"
            >
              <image href={imageData} x="0" y="0" width="1200" height="800" preserveAspectRatio="none" />
              <rect x="0" y="0" width="1200" height="800" fill="rgba(5, 14, 24, .12)" pointerEvents="none" />
              {edges.map(edge => {
                const source = nodes.find(node => node.id === edge.source);
                const target = nodes.find(node => node.id === edge.target);
                if (!source || !target) return null;
                const blocked = !clearEdges.includes(edge);
                return (
                  <line key={`${edge.source}-${edge.target}`}
                    x1={source.x} y1={source.y} x2={target.x} y2={target.y}
                    stroke={blocked ? '#ef4444' : '#22d3ee'} strokeWidth={blocked ? 5 : 4}
                    strokeDasharray={blocked ? '10 8' : undefined} opacity=".9" />
                );
              })}
              {walls.map((wall, index) => (
                <line key={`wall-${index}`}
                  x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y}
                  stroke="#101827" strokeWidth="12" strokeLinecap="round" />
              ))}
              {wallStart && <circle cx={wallStart.x} cy={wallStart.y} r="10" fill="#f97316" />}
              {nodes.map(node => (
                <g key={node.id} onClick={event => handleNodeClick(event, node.id)}>
                  <circle cx={node.x} cy={node.y} r="25"
                    fill={COLORS[node.type]} stroke={connectFrom === node.id ? '#f8fafc' : '#dbeafe'}
                    strokeWidth={connectFrom === node.id ? 6 : 3} />
                  <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize="18" fontWeight="800" pointerEvents="none">{node.type === 'exit' ? 'E' : node.id}</text>
                  <text x={node.x} y={node.y + 42} textAnchor="middle"
                    fill="white" stroke="#07111f" strokeWidth="5" paintOrder="stroke"
                    fontSize="18" fontWeight="700" pointerEvents="none">{node.label}</text>
                </g>
              ))}
            </svg>
            <div className="map-editor-canvas-hint">
              {mode === 'area' ? 'Click to place an area' : mode === 'connect' ? 'Select two areas to connect' : 'Click twice to draw a wall'}
            </div>
          </div>
        </div>

        {error && <p className="map-editor-error" role="alert">{error}</p>}
        <footer className="map-editor-footer">
          <span>Confirm every marked area, wall, and route connection before running simulations.</span>
          <div>
            <button type="button" className="map-editor-cancel" onClick={onCancel} disabled={saving}>Cancel</button>
            <button type="button" className="map-editor-save" onClick={submitDraft} disabled={saving}>
              {saving ? 'Creating map…' : 'Create map & route'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
