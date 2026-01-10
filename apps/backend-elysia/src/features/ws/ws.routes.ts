
import { Elysia, t } from 'elysia';
import { websocket } from '@elysiajs/websocket';
import { jwt } from '@elysiajs/jwt';
import { handleWsOpen, handleWsMessage, handleWsClose } from './ws.handlers';

export const wsRoutes = new Elysia()
    .use(websocket())
    .use(jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'default_secret'
    }))
    .ws('/ws', {

        async open(ws) {
            await handleWsOpen(ws as any);
        },
        async message(ws, message) {
            await handleWsMessage(ws as any, message);
        },
        async close(ws) {
            await handleWsClose(ws as any);
        }
    });

// Type augmentation for WS Data
declare module 'elysia' {
    interface WSContext {
        userId?: string;
        username?: string;
    }
}
