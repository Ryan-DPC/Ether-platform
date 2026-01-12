import { Elysia, t } from 'elysia';

export const installationRoutes = new Elysia({ prefix: '/api/installation' }).post(
  '/status',
  ({ body }) => {
    // Just a mock endpoint to silence 404s for now
    // In a real scenario, this would sync with DB or user profile
    console.log('[Installation] Status Sync:', body);
    return { success: true };
  },
  {
    body: t.Object({
      gameId: t.Optional(t.String()),
      status: t.String(),
      path: t.Optional(t.String()),
    }),
  }
);
