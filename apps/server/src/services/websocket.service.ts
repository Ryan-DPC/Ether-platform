import { Elysia } from 'elysia';

let elysiaServer: any = null;

export const setWebSocketServer = (server: any) => {
  elysiaServer = server;
};

export const getWebSocketServer = () => {
  return elysiaServer;
};

export class WebSocketService {
  static publish(topic: string, event: string, payload: any) {
    if (!elysiaServer) {
      console.warn('WebSocket server not initialized');
      return;
    }

    const message = JSON.stringify({
      type: event,
      data: payload,
    });

    elysiaServer.publish(topic, message);
  }

  // Helper for broadcasting to all (if needed, or just use specific topics)
  static broadcast(topic: string, event: string, payload: any) {
    this.publish(topic, event, payload);
  }
}
