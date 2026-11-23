const NODE_TYPE_LABELS = {
  room: 'Room',
  corridor: 'Corridor',
  junction: 'Junction',
  door: 'Door',
  stairs: 'Stairs',
  exit: 'Exit',
};

export function getNodeDisplayName(node, nodeId) {
  const label = String(node?.label || '').trim();
  if (label && label !== nodeId && !/^n\d+$/i.test(label)) return label;

  const typeLabel = NODE_TYPE_LABELS[node?.type?.toLowerCase()];
  if (typeLabel) return typeLabel;

  if (nodeId && !/^n\d+$/i.test(nodeId)) {
    return String(nodeId).replace(/[-_]+/g, ' ');
  }
  return 'Area';
}
