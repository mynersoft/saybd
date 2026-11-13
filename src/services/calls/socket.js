import { io } from 'socket.io-client';

export function createCallSocket(accessToken) {
  return io('/', {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 10000,
  });
}
