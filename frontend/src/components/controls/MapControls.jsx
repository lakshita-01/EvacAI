export default function MapControls({ controls, onChange }) {
  const items = [
    { key: 'showHeatmap', label: 'Risk heatmap', code: 'HM' },
    { key: 'showRoute',   label: 'Evacuation route', code: 'RT' },
    { key: 'showExits',   label: 'Exit markers', code: 'EX' },
    { key: 'showCameras', label: 'Cameras', code: 'CAM' },
    { key: 'showLabels',  label: 'Node labels', code: 'LB' },
  ];

  return (
    <div className="map-control-panel">
      <div className="map-layers-heading">
        <h3 className="panel-heading">Map Layers</h3>
        <span>{items.filter(({ key }) => controls[key] ?? true).length} / {items.length} ON</span>
      </div>
      <div className="toggle-row">
        {items.map(({ key, label, code }) => (
          <label key={key} className={`layer-toggle${controls[key] ?? true ? ' is-on' : ''}`}>
            <span className="layer-code" aria-hidden="true">{code}</span>
            <input type="checkbox" checked={controls[key] ?? true}
              onChange={e => onChange(key, e.target.checked)}
              aria-label={label} />
            <span className="layer-name">{label}</span>
            <span className="layer-switch" aria-hidden="true"><i /></span>
          </label>
        ))}
      </div>
    </div>
  );
}
