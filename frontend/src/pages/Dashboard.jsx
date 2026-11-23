import { useCallback, useEffect, useRef, useState } from 'react';
import { useEvacSystem } from '../hooks/useEvacSystem';
import FloorMap from '../components/map/FloorMap';
import AlertPanel from '../components/alerts/AlertPanel';
import StatsPanel from '../components/stats/StatsPanel';
import SimulationControls from '../components/controls/SimulationControls';
import MapControls from '../components/controls/MapControls';
import MapUploadControl from '../components/map/MapUploadControl';
import { resolveAlert, resolveAll } from '../services/api';
import { getNodeDisplayName } from '../utils/mapLabels';

const ANALYSIS_NOTICE_TTL = 10000;

export default function Dashboard() {
  const {
    mapData, route, alerts, loading, error, simResult, runSimulation, reset, setAlerts, activateMap,
    liveActive, liveCamera, setLiveCamera, toggleLive, liveStatus, imageUploading, uploadCameraImage,
  } = useEvacSystem();
  const [mapControls, setMapControls] = useState({
    showHeatmap: true, showRoute: true, showExits: true, showCameras: true, showLabels: true,
  });
  const [simLoading, setSimLoading] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState(null);
  const [alarmMuted, setAlarmMuted] = useState(false);
  const [emergencyDismissed, setEmergencyDismissed] = useState(false);
  const [dismissedRerouteKey, setDismissedRerouteKey] = useState(null);
  const [alarmSounding, setAlarmSounding] = useState(false);
  const [alarmBlocked, setAlarmBlocked] = useState(false);
  const alarmRef = useRef(null);
  const alarmIncidentRef = useRef(null);

  const rawRisk = (simResult?.detection?.riskLevel || simResult?.risk?.level || simResult?.route?.risk || route?.risk || 'normal').toLowerCase();
  const currentRisk = rawRisk === 'low' ? 'normal' : rawRisk;
  const isEmergency = ['moderate', 'high', 'critical'].includes(currentRisk);
  const needsAlarm = ['high', 'critical'].includes(currentRisk);
  const highIncidentKey = needsAlarm
    ? `${mapData?.mapId || 'active-map'}:${simResult?.detection?.cameraId || simResult?.cameraId || 'camera'}`
    : null;
  const emergencyKey = isEmergency
    ? `${mapData?.mapId || 'active-map'}:${currentRisk}:${simResult?.detection?.cameraId || simResult?.cameraId || 'monitoring'}`
    : null;
  const destinationType = mapData?.nodes?.[route?.exitNode]?.type || route?.destinationType;
  const destinationLabel = destinationType === 'stairs' ? 'Stairs' : 'Exit';
  const displayRoute = route?.route?.map(nodeId => getNodeDisplayName(mapData?.nodes?.[nodeId], nodeId));
  const startLabel = getNodeDisplayName(mapData?.nodes?.[route?.startNode], route?.startNode);
  const exitLabel = getNodeDisplayName(mapData?.nodes?.[route?.exitNode], route?.exitNode);
  const blockedNodeId = simResult?.route?.blockedNode;
  const blockedLabel = blockedNodeId
    ? getNodeDisplayName(mapData?.nodes?.[blockedNodeId], blockedNodeId)
    : '';
  const reroutedRoute = [route, simResult?.route].find(item => item?.rerouted && item.route?.length);
  const rerouteNodes = reroutedRoute?.route || [];
  const rerouteLabels = rerouteNodes.map(nodeId => getNodeDisplayName(mapData?.nodes?.[nodeId], nodeId));
  const rerouteBlockedId = reroutedRoute?.blockedNode || simResult?.route?.blockedNode;
  const rerouteBlockedLabel = rerouteBlockedId
    ? getNodeDisplayName(mapData?.nodes?.[rerouteBlockedId], rerouteBlockedId)
    : '';
  const rerouteExitId = reroutedRoute?.exitNode;
  const rerouteExitLabel = getNodeDisplayName(mapData?.nodes?.[rerouteExitId], rerouteExitId);
  const rerouteKey = reroutedRoute
    ? `${mapData?.mapId || 'active-map'}:${rerouteNodes.join('>')}:${rerouteBlockedId || ''}`
    : null;
  const showReroutedPath = Boolean(reroutedRoute && rerouteKey !== dismissedRerouteKey);

  useEffect(() => setEmergencyDismissed(false), [emergencyKey]);
  useEffect(() => setDismissedRerouteKey(null), [mapData?.mapId, rerouteKey]);

  useEffect(() => {
    if (highIncidentKey && alarmIncidentRef.current !== highIncidentKey) {
      setAlarmMuted(false);
      setAlarmBlocked(false);
    }
    alarmIncidentRef.current = highIncidentKey;
  }, [highIncidentKey]);

  const stopAlarm = useCallback((updateState = true) => {
    const alarm = alarmRef.current;
    if (!alarm) return;
    window.clearInterval(alarm.interval);
    try { alarm.oscillator?.stop(); } catch { /* oscillator may already be stopped */ }
    alarm.context?.close().catch(() => {});
    alarmRef.current = null;
    if (updateState) setAlarmSounding(false);
  }, []);

  const startAlarm = useCallback(async () => {
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) return false;

    try {
      let alarm = alarmRef.current;
      if (!alarm || alarm.context.state === 'closed') {
        alarm = { context: new AudioContextType(), oscillator: null, interval: null };
        alarmRef.current = alarm;
      }
      await alarm.context.resume();
      if (alarm.context.state !== 'running') return false;
      if (!alarm.oscillator) {
        const oscillator = alarm.context.createOscillator();
        const gain = alarm.context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 650;
        gain.gain.value = 0.035;
        oscillator.connect(gain);
        gain.connect(alarm.context.destination);
        oscillator.start();
        const wail = () => {
          const now = alarm.context.currentTime;
          oscillator.frequency.cancelScheduledValues(now);
          oscillator.frequency.setValueAtTime(650, now);
          oscillator.frequency.linearRampToValueAtTime(1120, now + 0.52);
          oscillator.frequency.linearRampToValueAtTime(650, now + 1.04);
        };
        alarm.oscillator = oscillator;
        alarm.gain = gain;
        wail();
        alarm.interval = window.setInterval(wail, 1080);
      }
      setAlarmSounding(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (needsAlarm && !alarmMuted) {
      setAlarmBlocked(false);
      startAlarm().then(started => {
        if (!cancelled) setAlarmBlocked(!started);
      });
    } else {
      stopAlarm();
      setAlarmSounding(false);
      setAlarmBlocked(false);
    }
    return () => {
      cancelled = true;
      stopAlarm(false);
    };
  }, [needsAlarm, alarmMuted, startAlarm, stopAlarm]);

  useEffect(() => {
    if (!simResult) return;
    const detection = simResult.detection;
    const analysis = simResult.fireSmoke ? simResult : detection?.rawResult;
    if (!analysis?.fireSmoke || !(simResult.cameraId || detection?.cameraId)) return;

    const risk = detection?.riskLevel || analysis.risk?.level || 'normal';
    const notice = {
      camera: simResult.cameraId || detection.cameraId,
      people: analysis.people?.count ?? simResult.people?.count ?? '—',
      fire: Boolean(analysis.fireSmoke.fireDetected ?? detection?.fireDetected),
      smoke: Boolean(analysis.fireSmoke.smokeDetected ?? detection?.smokeDetected),
      risk: String(risk).toUpperCase(),
    };
    const now = Date.now();
    setAnalysisNotice(current => {
      const stillActive = current?.expiresAt > now ? current : null;
      return {
        ...notice,
        id: stillActive?.id || `${now}-${Math.random().toString(36).slice(2)}`,
        expiresAt: stillActive?.expiresAt || now + ANALYSIS_NOTICE_TTL,
      };
    });
  }, [simResult]);

  useEffect(() => {
    if (!analysisNotice) return undefined;
    const timeout = window.setTimeout(() => {
      setAnalysisNotice(current => current?.id === analysisNotice.id ? null : current);
    }, Math.max(0, analysisNotice.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [analysisNotice]);

  function dismissAnalysisNotice() {
    setAnalysisNotice(null);
  }

  async function handleAlarmControl() {
    if (!alarmMuted && alarmSounding) {
      setAlarmMuted(true);
      return;
    }
    setAlarmMuted(false);
    const started = await startAlarm();
    setAlarmBlocked(!started);
  }

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

  async function handleDismissAlert(alert) {
    try {
      if (alert._id) await resolveAlert(alert._id);
      setAlerts(previous => previous.filter(item => alert._id ? item._id !== alert._id : item !== alert));
    } catch (dismissError) {
      console.error('Could not dismiss alert:', dismissError.message);
    }
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
    <div className={`app-shell ${isEmergency ? `is-emergency emergency-${currentRisk}` : ''}`}>

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

      {isEmergency && !emergencyDismissed && (
        <section className={`emergency-strip emergency-${currentRisk}`} role="status">
          <span className="emergency-beacon" aria-hidden="true" />
          <div className="emergency-copy">
            <strong>{currentRisk === 'moderate' ? 'ELEVATED RISK' : 'EMERGENCY RISK DETECTED'}</strong>
            <span>{simResult?.detection?.cameraId || simResult?.cameraId || 'Monitoring'} · {currentRisk.toUpperCase()}</span>
          </div>
          {needsAlarm && (
            <button type="button" className="alarm-control" onClick={handleAlarmControl}>
              {alarmMuted
                ? 'Unmute alarm'
                : alarmBlocked
                  ? 'Enable alarm sound'
                  : alarmSounding
                    ? 'Mute alarm'
                    : 'Start alarm'}
            </button>
          )}
          <button
            type="button"
            className="emergency-dismiss"
            onClick={() => { setEmergencyDismissed(true); if (needsAlarm) setAlarmMuted(true); }}
            aria-label={needsAlarm ? 'Dismiss emergency notification and mute alarm' : 'Dismiss emergency notification'}
            title={needsAlarm ? 'Dismiss and mute alarm' : 'Dismiss notification'}
          >×</button>
        </section>
      )}

      {analysisNotice && (
        <section
          key={analysisNotice.id}
          className={`analysis-notification risk-${analysisNotice.risk.toLowerCase()}`}
          role="status"
          aria-live="polite"
        >
          <div className="analysis-notification-top">
            <strong>CAMERA ANALYSIS</strong>
            <button type="button" onClick={dismissAnalysisNotice} aria-label="Dismiss analysis notification">×</button>
          </div>
          <div className="analysis-notification-camera">{analysisNotice.camera}</div>
          <div className="analysis-notification-results">
            <span>{analysisNotice.people} people</span>
            <span className={analysisNotice.fire ? 'detected' : ''}>{analysisNotice.fire ? 'Fire detected' : 'No fire'}</span>
            <span className={analysisNotice.smoke ? 'detected' : ''}>{analysisNotice.smoke ? 'Smoke detected' : 'No smoke'}</span>
            <strong>RISK {analysisNotice.risk}</strong>
          </div>
          <div className="analysis-notification-progress" aria-hidden="true" />
        </section>
      )}

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
            <MapUploadControl onActivateMap={activateMap} mapData={mapData} />
          </section>
        </aside>

        {/* ── Floor map (center) ── */}
        <main className="map-column">
          {showReroutedPath && (
            <section className="rerouted-path-block" aria-label="New evacuation route">
              <button type="button" className="rerouted-path-dismiss" onClick={() => setDismissedRerouteKey(rerouteKey)} aria-label="Dismiss rerouted path notification">×</button>
              <div className="rerouted-path-heading">
                <span className="reroute-signal" aria-hidden="true">!</span>
                <div>
                  <strong>EVACUATION ROUTE REROUTED</strong>
                  <span>{rerouteBlockedLabel ? `Avoid ${rerouteBlockedLabel}` : 'A new safe route is active'}</span>
                </div>
                <b>{rerouteExitId ? `TO ${rerouteExitLabel}` : 'FOLLOW THE HIGHLIGHTED PATH'}</b>
              </div>
              <div className="rerouted-path-nodes">
                {rerouteLabels.map((label, index) => (
                  <span className="rerouted-path-step" key={`${rerouteNodes[index]}-${index}`}>
                    {index > 0 && <i aria-hidden="true">›</i>}
                    <strong>{label}</strong>
                  </span>
                ))}
              </div>
            </section>
          )}
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
                Route: {displayRoute?.join(' → ')}
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
              <span>Start: <strong>{startLabel}</strong></span>
              <span>{destinationLabel}: <strong>{exitLabel}</strong></span>
              <span>Distance: <strong>{route.distance}m</strong></span>
              {route.rerouted && blockedLabel && <span>Blocked: <strong className="text-red-400">{blockedLabel}</strong></span>}
            </div>
          )}
        </main>

        {/* ── Right sidebar ── */}
        <aside className="right-rail">
          <SimulationControls
            onSimulate={handleSimulate} onReset={handleReset} loading={simLoading}
            liveActive={liveActive} liveCamera={liveCamera}
            onLiveCameraChange={setLiveCamera} onLiveToggle={toggleLive}
            liveStatus={liveStatus} imageUploading={imageUploading}
            onCameraImageUpload={file => uploadCameraImage(file, liveCamera)} mapData={mapData}
          />
          <div className="flex-1 min-h-0">
            <AlertPanel alerts={alerts} onResolveAll={handleResolveAll} onDismiss={handleDismissAlert} />
          </div>
        </aside>

      </div>
    </div>
  );
}
