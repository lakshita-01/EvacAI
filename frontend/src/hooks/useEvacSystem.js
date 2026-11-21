import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDemoMap, getMap, calcRoute, simulate, resetAllHazards, seedCameras, liveFrame,
} from '../services/api';
import socket from '../services/socket';

export function useEvacSystem() {
  const [mapData,   setMapData]   = useState(null);
  const [route,     setRoute]     = useState(null);
  const [alerts,    setAlerts]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [simResult, setSimResult] = useState(null);

  // Live webcam state
  const [liveActive,   setLiveActive]   = useState(false);
  const [liveCamera,   setLiveCamera]   = useState('CAM-01');
  const [liveStatus,   setLiveStatus]   = useState('');
  const streamRef    = useRef(null);
  const intervalRef  = useRef(null);
  const videoRef     = useRef(null);

  // Load demo map on mount
  useEffect(() => {
    (async () => {
      try {
        await seedCameras();
        await getDemoMap();
        await resetAllHazards('DEMO-MAP-001');
        const res = await getDemoMap();
        setMapData(res.data.mapData || res.data);
        try {
          const routeRes = await calcRoute({ mapId: 'DEMO-MAP-001', startNode: 'ROOM-A' });
          setRoute(routeRes.data);
        } catch (e) {
          if (e.response?.status !== 422) throw e;
          setRoute(null);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Socket.IO listeners
  useEffect(() => {
    socket.on('alert', (alert) => setAlerts(prev => [alert, ...prev].slice(0, 50)));
    socket.on('stateUpdate', (update) => {
      if (update.route?.route) setRoute(update.route);
      if (update.mapId) {
        getMap(update.mapId).then(res => setMapData(res.data.mapData || res.data));
      }
    });
    return () => { socket.off('alert'); socket.off('stateUpdate'); };
  }, []);

  // Capture one frame from the video element and POST it
  const captureAndSend = useCallback(async (cameraId) => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const form = new FormData();
      form.append('file', blob, 'frame.jpg');
      form.append('camera_id', cameraId);
      form.append('room_capacity', '50');
      try {
        const res = await liveFrame(form);
        const risk = res.data?.risk?.level || 'unknown';
        const fire  = res.data?.fireSmoke?.fireDetected  ? '🔥' : '';
        const smoke = res.data?.fireSmoke?.smokeDetected ? '💨' : '';
        const ppl   = res.data?.people?.count ?? '?';
        setLiveStatus(`${cameraId} | people: ${ppl} ${fire}${smoke} risk: ${risk.toUpperCase()}`);
      } catch (e) {
        setLiveStatus(`ERROR: ${e.message}`);
      }
    }, 'image/jpeg', 0.85);
  }, []);

  const startLive = useCallback(async (cameraId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      // Create a hidden video element to feed frames from
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay  = true;
      video.muted     = true;
      videoRef.current = video;
      await new Promise(resolve => { video.onloadedmetadata = resolve; });

      setLiveActive(true);
      setLiveStatus('Starting...');

      intervalRef.current = setInterval(() => captureAndSend(cameraId), 1500);
    } catch (e) {
      setLiveStatus(`ERROR: ${e.message}`);
    }
  }, [captureAndSend]);

  const stopLive = useCallback(() => {
    clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current  = null;
    videoRef.current   = null;
    setLiveActive(false);
    setLiveStatus('');
  }, []);

  const toggleLive = useCallback(() => {
    if (liveActive) stopLive();
    else startLive(liveCamera);
  }, [liveActive, liveCamera, startLive, stopLive]);

  // Stop stream on unmount
  useEffect(() => () => stopLive(), [stopLive]);

  const runSimulation = useCallback(async (scenario, nodeId, riskLevel, startNode) => {
    const activeMapId = mapData?.mapId || 'DEMO-MAP-001';
    try {
      const res = await simulate({ scenario, mapId: activeMapId, nodeId, riskLevel, startNode });
      setSimResult(res.data);
      setRoute(res.data.route?.route ? res.data.route : null);
      const mapRes = await getMap(activeMapId);
      setMapData(mapRes.data.mapData || mapRes.data);
    } catch (e) {
      setError(e.message);
    }
  }, [mapData]);

  const reset = useCallback(async () => {
    const activeMapId = mapData?.mapId || 'DEMO-MAP-001';
    try {
      await resetAllHazards(activeMapId);
      const mapRes = activeMapId === 'DEMO-MAP-001' ? await getDemoMap() : await getMap(activeMapId);
      setMapData(mapRes.data.mapData || mapRes.data);
      const nodes = mapRes.data.mapData?.nodes || mapRes.data.nodes || {};
      const startNode = Object.values(nodes).find(node => node.type === 'room')?.id || Object.keys(nodes)[0];
      const routeRes = await calcRoute({ mapId: activeMapId, startNode });
      setRoute(routeRes.data);
      setAlerts([]);
      setSimResult(null);
    } catch (e) {
      setError(e.message);
    }
  }, [mapData]);

  const activateMap = useCallback(async (nextMap) => {
    const startNode = Object.values(nextMap.nodes || {}).find(node => node.type === 'room')?.id ||
      Object.keys(nextMap.nodes || {})[0];
    if (liveActive) stopLive();
    setError(null);
    setMapData(nextMap);
    setAlerts([]);
    setSimResult(null);
    try {
      if (!startNode) {
        setRoute(null);
        return;
      }
      const routeRes = await calcRoute({ mapId: nextMap.mapId, startNode });
      setRoute(routeRes.data);
    } catch (e) {
      if (e.response?.status === 422) {
        setRoute(null);
        return;
      }
      setError(e.message);
    }
  }, [liveActive, stopLive]);

  return {
    mapData, route, alerts, loading, error, simResult, runSimulation, reset, setAlerts, activateMap,
    liveActive, liveCamera, setLiveCamera, toggleLive, liveStatus,
  };
}
