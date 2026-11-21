import { io } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:3001' : undefined);
if (!socketUrl) {
  throw new Error('VITE_SOCKET_URL must be set for production deployments.');
}

const socket = io(socketUrl, { autoConnect: true });
export default socket;
