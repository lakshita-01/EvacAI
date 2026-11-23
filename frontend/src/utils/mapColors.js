// Risk level → fill color (heatmap overlay)
export const RISK_COLORS = {
  normal:   'rgba(34,197,94,0.15)',
  moderate: 'rgba(234,179,8,0.25)',
  high:     'rgba(249,115,22,0.40)',
  critical: 'rgba(239,68,68,0.60)',
};

export const RISK_STROKE = {
  normal:   '#22c55e',
  moderate: '#eab308',
  high:     '#f97316',
  critical: '#ef4444',
};

export const NODE_TYPE_COLORS = {
  room:      '#1e40af',
  corridor:  '#374151',
  junction:  '#4b5563',
  stairs:    '#7c3aed',
  exit:      '#16a34a',
  door:      '#92400e',
};

export const NODE_RADIUS = {
  room:      18,
  corridor:  14,
  junction:  13,
  stairs:    13,
  exit:      16,
  door:      10,
};
