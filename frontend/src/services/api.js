import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : undefined);
if (!apiBaseUrl) {
  throw new Error('VITE_API_URL must be set for production deployments.');
}

const api = axios.create({ baseURL: apiBaseUrl.replace(/\/+$/, '') });

export const getHealth    = ()           => api.get('/ai/health');
export const getDemoMap   = ()           => api.get('/maps/demo');
export const getMap       = (id)         => api.get(`/maps/${id}`);
export const uploadDxf    = (formData)   => api.post('/maps/upload', formData);
export const createDraftMap = (body)     => api.post('/maps/draft', body);
export const updateDraftMap = (id, body)  => api.put(`/maps/${id}/draft`, body);
export const getAlerts    = ()           => api.get('/alerts');
export const resolveAlert = (id)         => api.patch(`/alerts/${id}`);
export const resolveAll   = ()           => api.post('/alerts/resolve-all');
export const getCurrent   = ()           => api.get('/analysis/current');
export const liveFrame    = (formData)   => api.post('/analysis/live', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const simulate     = (body)       => api.post('/analysis/simulate', body);
export const calcRoute    = (body)       => api.post('/routes/calculate', body);
export const reroute      = (body)       => api.post('/routes/reroute', body);
export const resetHazard  = (body)       => api.post('/routes/reset', body);
export const resetAllHazards = (mapId)   => api.post('/routes/reset-all', { mapId });
export const seedCameras  = ()           => api.post('/cameras/seed-demo');
export const getCameras   = ()           => api.get('/cameras');
