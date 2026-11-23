import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDemoMap, getMap, calcRoute, simulate, resetAllHazards, seedCameras, liveFrame,
} from '../services/api';
import socket from '../services/socket';

const ACTIVE_MAP_STORAGE_KEY = 'evac-ai-active-map-id';

function getCameraTarget(mapData, cameraId) {
  const configured = mapData?.cameras?.find(camera => camera.cameraId === cameraId);
  const area = Object.values(mapData?.nodes || {}).find(
    node => node.type !== 'exit' && `CAM-${node.id}` === cameraId,
  );
  const nodeId = configured?.nodeId || area?.id;
  if (!nodeId) return null;
  const areas = Object.values(mapData?.nodes || {});
  const firstRoom = areas.find(node => node.type === 'room');
  return {
    nodeId,
    mapId: mapData.mapId,
    startNode: mapData.isDemo ? 'ROOM-A' : (firstRoom?.id || nodeId),
  };
}

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
  const [imageUploading, setImageUploading] = useState(false);
  const streamRef    = useRef(null);
  const intervalRef  = useRef(null);
  const videoRef     = useRef(null);
  const activeMapIdRef = useRef(null);

  useEffect(() => {
    if (!mapData?.mapId) return;
    const areas = Object.values(mapData.nodes || {});
    const firstRoom = areas.find(node => node.type === 'room') || areas.find(node => node.type !== 'exit');
    const nextCamera = mapData.isDemo
      ? 'CAM-01'
      : (mapData.cameras || [])[0]?.cameraId || (firstRoom ? `CAM-${firstRoom.id}` : '');
    setLiveCamera(nextCamera);
  }, [mapData?.mapId]);

  // Load demo map on mount
  useEffect(() => {
    (async () => {
      try {
        await seedCameras();
        let savedMapId = null;
        try { savedMapId = window.localStorage.getItem(ACTIVE_MAP_STORAGE_KEY); } catch { /* storage may be disabled */ }
        if (savedMapId && savedMapId !== 'DEMO-MAP-001') {
          try {
            const savedResponse = await getMap(savedMapId);
            const savedMap = savedResponse.data.mapData || savedResponse.data;
            activeMapIdRef.current = savedMap.mapId;
            setMapData(savedMap);
            const nodes = Object.values(savedMap.nodes || {});
            const startNode = nodes.find(node => node.type === 'room')?.id || nodes[0]?.id;
            if (startNode) {
              try {
                const routeRes = await calcRoute({ mapId: savedMap.mapId, startNode });
                setRoute(routeRes.data);
              } catch {
                setRoute(null);
              }
            }
            return;
          } catch (restoreError) {
            if (restoreError.response?.status !== 404) throw restoreError;
            try { window.localStorage.removeItem(ACTIVE_MAP_STORAGE_KEY); } catch { /* storage may be disabled */ }
          }
        }
        await getDemoMap();
        await resetAllHazards('DEMO-MAP-001');
        const res = await getDemoMap();
        const demoMap = res.data.mapData || res.data;
        activeMapIdRef.current = demoMap.mapId;
        setMapData(demoMap);
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
      if (update.mapId && activeMapIdRef.current && update.mapId !== activeMapIdRef.current) return;
      if (update.route?.route) setRoute(update.route);
      if (update.type === 'LIVE' && update.detection) {
        setSimResult({ detection: update.detection, route: update.route || null, analysisSource: 'live' });
      }
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
      const target = getCameraTarget(mapData, cameraId);
      if (target) {
        form.append('node_id', target.nodeId);
        form.append('map_id', target.mapId);
        form.append('start_node', target.startNode);
      }
      try {
        const res = await liveFrame(form);
        setSimResult({ ...res.data, analysisSource: 'live' });
        const risk = res.data?.risk?.level || 'unknown';
        const fire  = res.data?.fireSmoke?.fireDetected  ? '🔥' : '';
        const smoke = res.data?.fireSmoke?.smokeDetected ? '💨' : '';
        const ppl   = res.data?.people?.count ?? '?';
        setLiveStatus(`${cameraId} | people: ${ppl} ${fire}${smoke} risk: ${risk.toUpperCase()}`);
      } catch (e) {
        setLiveStatus(`ERROR: ${e.message}`);
      }
    }, 'image/jpeg', 0.85);
  }, [mapData]);

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

  const uploadCameraImage = useCallback(async (file, cameraId) => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('camera_id', cameraId);
    form.append('room_capacity', '50');
    const target = getCameraTarget(mapData, cameraId);
    if (target) {
      form.append('node_id', target.nodeId);
      form.append('map_id', target.mapId);
      form.append('start_node', target.startNode);
    }
    setImageUploading(true);
    setLiveStatus(`Analyzing ${file.name} for ${cameraId}...`);
    try {
      const res = await liveFrame(form);
      setSimResult({ ...res.data, analysisSource: 'upload' });
      const risk = res.data?.risk?.level || 'unknown';
      const fire = res.data?.fireSmoke?.fireDetected ? 'Fire detected' : '';
      const smoke = res.data?.fireSmoke?.smokeDetected ? 'Smoke detected' : '';
      const hazards = [fire, smoke].filter(Boolean).join(', ') || 'No fire or smoke detected';
      const people = res.data?.people?.count ?? '?';
      setLiveStatus(`${cameraId} | people: ${people} | ${hazards} | risk: ${risk.toUpperCase()}`);
    } catch (e) {
      setLiveStatus(`ERROR: ${e.response?.data?.error || e.message}`);
    } finally {
      setImageUploading(false);
    }
  }, [mapData]);

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
    activeMapIdRef.current = nextMap.mapId;
    try { window.localStorage.setItem(ACTIVE_MAP_STORAGE_KEY, nextMap.mapId); } catch { /* storage may be disabled */ }
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
    liveActive, liveCamera, setLiveCamera, toggleLive, liveStatus, imageUploading, uploadCameraImage,
  };
}
