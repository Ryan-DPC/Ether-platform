
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
            data: payload
        });

        // Bun's server.publish returns number of recipients
        elysiaServer.publish(topic, message);
    }

    static broadcast(event: string, payload: any) {
        // Broadcasts to "global" topic if we subscribe everyone to it,
        // or we might need another strategy. For now, assuming distinct topics.
        // If we want real broadcast, we should subscribe all users to 'global'.
        this.publish('global', event, payload);
    }
}
