import { getNodeDisplayName } from '../../utils/mapLabels';

export default function StatsPanel({ route, simResult, mapData }) {
  const risk = simResult?.detection?.riskLevel || simResult?.risk?.level || simResult?.route?.risk || route?.risk || 'normal';
  const rerouted = simResult?.route?.rerouted || route?.rerouted;
  const status = !route ? 'NO ROUTE' : rerouted ? 'REROUTED' : 'ACTIVE';
  const riskLabel = String(risk).toUpperCase();
  const destinationId = route?.exitNode;
  const destination = destinationId
    ? getNodeDisplayName(mapData?.nodes?.[destinationId], destinationId)
    : '—';
  const destinationType = mapData?.nodes?.[destinationId]?.type || route?.destinationType;
  const destinationLabel = destinationType === 'stairs' ? 'Stairs' : 'Exit';
  const originId = route?.startNode;
  const origin = originId ? getNodeDisplayName(mapData?.nodes?.[originId], originId) : '—';
  const blockedNodeId = simResult?.route?.blockedNode || simResult?.blockedNodes?.[0];
  const blockedNode = blockedNodeId
    ? getNodeDisplayName(mapData?.nodes?.[blockedNodeId], blockedNodeId)
    : 'None';
  const routePath = route?.route || [];
  const displayRoute = routePath.map(nodeId => getNodeDisplayName(mapData?.nodes?.[nodeId], nodeId));
  const routeNodes = routePath.length || '—';
  const distance = route?.distance ? `${route.distance}m` : '—';
  const routeStatusClass = !route
    ? 'no-route'
    : rerouted
      ? 'rerouted'
      : String(risk).toLowerCase() === 'critical'
        ? 'critical'
        : 'active';

  return (
    <section className="status-overview" aria-label="Evacuation route status">
      <div className={`desktop-route-status ${routeStatusClass}`}>
        <div className="route-status-heading">
          <span className="route-status-kicker">Evacuation route</span>
          <span className={`route-risk risk-${String(risk).toLowerCase()}`}>{riskLabel}</span>
        </div>
        <div className="route-status-main">
          <span className="route-status-beacon" aria-hidden="true" />
          <div>
            <strong>{status}</strong>
            <span>{rerouted ? 'Safe path recalculated' : route ? 'Cleared for evacuation' : 'No safe path found'}</span>
          </div>
        </div>
        <div className="route-endpoints">
          <div>
            <span>Origin</span>
            <strong>{origin}</strong>
          </div>
          <span className="route-endpoint-arrow" aria-hidden="true">→</span>
          <div>
            <span>{destinationLabel}</span>
            <strong>{destination}</strong>
          </div>
        </div>
      </div>

      <div className="route-metrics" aria-label="Route metrics">
        <div className="route-metric-primary">
          <div>
            <span>Distance</span>
            <strong>{distance}</strong>
          </div>
          <div>
            <span>Nodes</span>
            <strong>{routeNodes}</strong>
          </div>
        </div>
        <div className="route-metric-row">
          <span>Blocked node</span>
          <strong className={blockedNode !== 'None' ? 'has-blockage' : ''}>{blockedNode}</strong>
        </div>
        <div className="route-path">
          <div className="route-path-heading">
            <span>Route path</span>
            <small>{route?.algorithm ? String(route.algorithm).toUpperCase() : '—'}</small>
          </div>
          {routePath.length ? (
            <div className="route-path-list">
              {routePath.slice(0, 5).map((node, index) => (
                <span key={`${node}-${index}`} className="route-path-node">
                  {index > 0 && <i aria-hidden="true" />}
                  {displayRoute[index]}
                </span>
              ))}
              {routePath.length > 5 && <span className="route-path-more">+{routePath.length - 5}</span>}
            </div>
          ) : (
            <span className="route-path-empty">Awaiting route</span>
          )}
        </div>
      </div>
    </section>
  );
}
