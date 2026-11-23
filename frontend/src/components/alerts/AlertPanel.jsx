const SEVERITY_STYLES = {
  CRITICAL: 'border-red-600 bg-red-950 text-red-300',
  HIGH:     'border-orange-500 bg-orange-950 text-orange-300',
  WARNING:  'border-yellow-500 bg-yellow-950 text-yellow-300',
  INFO:     'border-blue-500 bg-blue-950 text-blue-300',
};

const TYPE_ICON = {
  FIRE:          '🔥',
  SMOKE:         '💨',
  CROWD:         '👥',
  ROUTE_BLOCKED: '🚫',
  REROUTED:      '🔄',
  INFO:          'ℹ️',
};

export default function AlertPanel({ alerts, onResolveAll, onDismiss }) {
  return (
    <div className="alerts-panel">
      <div className="alerts-header">
        <h3 className="panel-heading">Alerts ({alerts.filter(a => !a.resolved).length})</h3>
        {alerts.length > 0 && (
          <button onClick={onResolveAll}
            className="clear-button">
            Clear all
          </button>
        )}
      </div>

      <div className="alerts-list">
        {alerts.length === 0 && (
          <div className="empty-alerts">No active alerts</div>
        )}
        {alerts.filter(a => !a.resolved).map((alert, i) => (
          <div key={alert._id || i}
            className={`alert-item ${(alert.severity || 'INFO').toLowerCase()}`}>
            <button
              type="button"
              className="alert-dismiss"
              onClick={() => onDismiss(alert)}
              aria-label={`Dismiss ${alert.type?.toLowerCase() || 'notification'} alert`}
              title="Dismiss alert"
            >×</button>
            <div className="alert-item-head">
              <span aria-hidden="true">{TYPE_ICON[alert.type] || 'ℹ️'}</span>
              <div className="alert-item-body">
                <div className="alert-type">{alert.type?.replace('_', ' ')}</div>
                <div className="alert-message">{alert.message}</div>
                {alert.location && (
                  <div className="alert-meta">Location: {alert.location}</div>
                )}
                <div className="alert-meta">
                  {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ''}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
