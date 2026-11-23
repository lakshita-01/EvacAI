import { RISK_COLORS, RISK_STROKE, NODE_TYPE_COLORS, NODE_RADIUS } from '../../utils/mapColors';
import { getNodeDisplayName } from '../../utils/mapLabels';
import { useEffect, useState } from 'react';

const W = 800;
const H = 520;
const ZOOM_LEVELS = [0.67, 0.75, 1, 1.25, 1.5, 1.75, 2];

function scaleX(x) { return (x / 1200) * W; }
function scaleY(y) { return (y / 800) * H; }

export default function FloorMap({ mapData, route, showControls = {}, mapImage = null }) {
  const floorImage = mapImage || mapData?.imageData;
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [mapData?.mapId, floorImage]);

  if (!mapData) return (
    <div className="flex items-center justify-center h-full text-gray-500">
      Loading map...
    </div>
  );

  const { nodes = {}, edges = [], exits = [], cameras = [], walls = [] } = mapData;
  const routeSet = new Set(route?.route || []);
  const routeArr = route?.route || [];
  const routeColor = route?.rerouted ? '#facc15' : '#22d3ee';

  const {
    showHeatmap = true,
    showRoute   = true,
    showExits   = true,
    showCameras = true,
    showLabels  = true,
  } = showControls;

  const nodeValues = Object.values(nodes);
  const scaledNodes = nodeValues.map(node => ({ x: scaleX(node.x), y: scaleY(node.y) }));
  const xs = scaledNodes.map(node => node.x);
  const ys = scaledNodes.map(node => node.y);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : W;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : H;
  const graphWidth = Math.max(maxX - minX, 1);
  const graphHeight = Math.max(maxY - minY, 1);
  const padding = Math.max(graphWidth, graphHeight) * 0.12;
  const baseViewBox = floorImage
    ? `0 0 ${W} ${H}`
    : `${minX - padding} ${minY - padding} ${graphWidth + padding * 2} ${graphHeight + padding * 2}`;

  const [baseX, baseY, baseWidth, baseHeight] = baseViewBox.split(' ').map(Number);
  const zoomWidth = baseWidth / zoom;
  const zoomHeight = baseHeight / zoom;
  const viewBox = `${baseX + (baseWidth - zoomWidth) / 2} ${baseY + (baseHeight - zoomHeight) / 2} ${zoomWidth} ${zoomHeight}`;

  return (
    <div className="floor-map-viewport">
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{ background: '#0f172a', borderRadius: 8 }}
      >
      {floorImage && (
        <image
          href={floorImage}
          x={0}
          y={0}
          width={W}
          height={H}
          preserveAspectRatio="none"
        />
      )}

      {walls.map((wall, index) => (
        <line key={`wall-${index}`}
          x1={scaleX(wall.x1)} y1={scaleY(wall.y1)}
          x2={scaleX(wall.x2)} y2={scaleY(wall.y2)}
          stroke={floorImage ? '#111827' : '#526274'}
          strokeWidth={floorImage ? 8 : 5}
          strokeLinecap="round"
          opacity={floorImage ? 0.9 : 0.7}
        />
      ))}

      {/* ── Edges ── */}
      {edges.map((edge, i) => {
        const s = nodes[edge.source];
        const t = nodes[edge.target];
        if (!s || !t) return null;
        const isBlocked = edge.blocked;
        const isOnRoute = routeArr.includes(edge.source) && routeArr.includes(edge.target) &&
          Math.abs(routeArr.indexOf(edge.source) - routeArr.indexOf(edge.target)) === 1;

        return (
          <line key={i}
            x1={scaleX(s.x)} y1={scaleY(s.y)}
            x2={scaleX(t.x)} y2={scaleY(t.y)}
            stroke={isBlocked ? '#ef4444' : isOnRoute && showRoute ? routeColor : '#374151'}
            strokeWidth={isBlocked ? 3 : isOnRoute && showRoute ? 6 : 1.5}
            strokeDasharray={isBlocked ? '6,4' : isOnRoute ? '0' : '0'}
            opacity={0.8}
          />
        );
      })}

      {/* ── Route path highlight ── */}
      {showRoute && routeArr.length > 1 && (() => {
        const pts = routeArr
          .map(id => nodes[id])
          .filter(Boolean)
          .map(n => `${scaleX(n.x)},${scaleY(n.y)}`)
          .join(' ');
        return (
          <>
            <polyline points={pts} fill="none" stroke="#07111f"
              strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
            <polyline points={pts} fill="none" stroke={routeColor}
              strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      })()}

      {/* ── Nodes ── */}
      {Object.values(nodes).map((node) => {
        const cx = scaleX(node.x);
        const cy = scaleY(node.y);
        const baseRadius = NODE_RADIUS[node.type] || 18;
        const r = floorImage ? baseRadius * 0.62 : baseRadius;
        const haloRadius = floorImage ? r + 5 : r + 12;
        const labelOffset = floorImage ? r + 7 : r + 8;
        const isExit    = node.type === 'exit';
        const isBlocked = node.blocked;
        const isOnRoute = routeSet.has(node.id);
        const risk      = node.risk || 'normal';

        return (
          <g key={node.id}>
            {/* Heatmap overlay */}
            {showHeatmap && risk !== 'normal' && (
              <circle cx={cx} cy={cy} r={haloRadius}
                fill={RISK_COLORS[risk]} stroke={RISK_STROKE[risk]}
                strokeWidth={1.5} opacity={0.7} />
            )}

            {/* Node circle */}
            <circle cx={cx} cy={cy} r={r}
              fill={isBlocked ? '#7f1d1d' : NODE_TYPE_COLORS[node.type] || '#374151'}
              stroke={isOnRoute && showRoute ? routeColor : isBlocked ? '#ef4444' : '#6b7280'}
              strokeWidth={isOnRoute ? 3 : 1.5}
            />

            {/* Exit marker */}
            {isExit && showExits && (
              <text cx={cx} cy={cy} x={cx} y={cy + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={floorImage ? '9' : '11'} fill="#fff">🟢</text>
            )}

            {/* Blocked X */}
            {isBlocked && (
              <>
                <line x1={cx-r*0.45} y1={cy-r*0.45} x2={cx+r*0.45} y2={cy+r*0.45} stroke="#ef4444" strokeWidth={2.5} />
                <line x1={cx+r*0.45} y1={cy-r*0.45} x2={cx-r*0.45} y2={cy+r*0.45} stroke="#ef4444" strokeWidth={2.5} />
              </>
            )}

            {/* Label */}
            {showLabels && (
              <text x={cx} y={cy + labelOffset} textAnchor="middle"
                fontSize={floorImage ? '9' : '8'}
                fill={floorImage ? '#f8fafc' : '#9ca3af'}
                stroke={floorImage ? 'rgba(7,17,31,.9)' : 'none'}
                strokeWidth={floorImage ? 3 : 0}
                paintOrder="stroke">{getNodeDisplayName(node, node.id)}</text>
            )}
          </g>
        );
      })}

      {/* ── Camera icons ── */}
      {showCameras && cameras.map((cam) => {
        const node = nodes[cam.nodeId];
        if (!node) return null;
        const cx = scaleX(node.x) + 22;
        const cy = scaleY(node.y) - 22;
        return (
          <g key={cam.cameraId}>
            <circle cx={cx} cy={cy} r={9} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1.5} />
            <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#93c5fd">📷</text>
            <title>{cam.name} ({cam.cameraId})</title>
          </g>
        );
      })}

      {/* ── Route direction arrow at exit ── */}
      {showRoute && route?.exitNode && nodes[route.exitNode] && (() => {
        const n = nodes[route.exitNode];
        const destinationLabel = n.type === 'stairs' ? 'STAIRS' : 'EXIT';
        return (
          <text x={scaleX(n.x)} y={scaleY(n.y) - 36}
            textAnchor="middle" fontSize="18" fill="#22c55e">▶ {destinationLabel}</text>
        );
      })()}

      {/* ── Legend ── */}
      <g transform={`translate(${floorImage ? 14 : minX - padding * 0.75}, ${floorImage ? 14 : minY - padding * 0.75})`}>
        {floorImage && <rect x="-7" y="-7" width="286" height="44" rx="6" fill="#07111f" opacity=".88" />}
        {[
          { color: '#1e40af', label: 'Room' },
          { color: '#374151', label: 'Corridor' },
          { color: '#16a34a', label: 'Exit' },
          { color: '#7c3aed', label: 'Stairs' },
          { color: '#ef4444', label: 'Blocked' },
          { color: routeColor, label: route?.rerouted ? 'Rerouted route' : 'Route' },
        ].map(({ color, label }, i) => (
          <g key={label} transform={`translate(${(i % 3) * 90}, ${Math.floor(i / 3) * 18})`}>
            <rect width={12} height={12} rx={2} fill={color} />
            <text x={16} y={10} fontSize="9" fill={floorImage ? '#dbe7f3' : '#9ca3af'}>{label}</text>
          </g>
        ))}
      </g>
      </svg>
      <div className="map-zoom-controls" aria-label="Floor map zoom controls">
        <button type="button"
          onClick={() => setZoom(value => {
            const currentIndex = ZOOM_LEVELS.findIndex(level => level === value);
            return ZOOM_LEVELS[Math.max(0, currentIndex - 1)];
          })}
          disabled={zoom <= ZOOM_LEVELS[0]}
          aria-label="Zoom out"
          title="Zoom out">
          <span aria-hidden="true">−</span>
        </button>
        <output className="map-zoom-value" aria-live="polite" aria-label={`Zoom ${Math.round(zoom * 100)} percent`}>
          {Math.round(zoom * 100)}%
        </output>
        <button type="button"
          onClick={() => setZoom(value => {
            const currentIndex = ZOOM_LEVELS.findIndex(level => level === value);
            return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, currentIndex + 1)];
          })}
          disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
          aria-label="Zoom in"
          title="Zoom in">
          <span aria-hidden="true">+</span>
        </button>
        <button type="button"
          className="map-zoom-reset"
          onClick={() => setZoom(1)}
          disabled={zoom === 1}
          aria-label="Reset map zoom"
          title="Reset map zoom">
          Reset
        </button>
      </div>
    </div>
  );
}
