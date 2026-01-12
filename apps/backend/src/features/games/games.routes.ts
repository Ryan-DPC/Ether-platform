import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { GamesService } from './games.service';

export const gamesRoutes = new Elysia({ prefix: '/api/games' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'default_secret',
    })
  )
  .derive(async ({ headers, jwt }) => {
    const auth = headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      return { user: null };
    }
    const token = auth.slice(7);
    const payload = await jwt.verify(token);
    return { user: payload };
  })
  .get('/all', async () => {
    return await GamesService.getAllGames();
  })
  .get('/:id', async ({ params: { id }, set }) => {
    try {
      const game = await GamesService.getGameByName(id);
      if (!game) {
        set.status = 404;
        return { message: 'Game not found' };
      }
      return game;
    } catch (err: any) {
      set.status = 404;
      return { message: err.message };
    }
  })
  .get('/details/:id', async ({ params: { id }, user, set }) => {
    try {
      const userId = user ? (user as any).id : null;
      return await GamesService.getGameDetails(id, userId);
    } catch (err: any) {
      set.status = 404;
      return { message: err.message };
    }
  })
  .get('/:id/manifest', async ({ params: { id }, set }) => {
    try {
      return await GamesService.getManifest(id);
    } catch (err: any) {
      set.status = 404;
      return { error: err.message };
    }
  })
  .get('/:id/manifest-url', async ({ params: { id }, set }) => {
    try {
      const url = await GamesService.getManifestUrl(id);
      return { url };
    } catch (err: any) {
      set.status = 404;
      return { message: err.message };
    }
  })
  .post(
    '/add',
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: 'Unauthorized' };
      }
      try {
        const gameId = await GamesService.addGame(body);
        set.status = 201;
        return { message: 'Game added successfully.', id: gameId };
      } catch (err: any) {
        set.status = 500;
        return { message: 'Error adding game.' };
      }
    },
    {
      body: t.Object({
        game_name: t.String(),
        folder_name: t.String(),
        description: t.Optional(t.String()),
        genre: t.Optional(t.String()),
        developer: t.Optional(t.String()),
        price: t.Optional(t.Number()),
        github_url: t.Optional(t.String()),
        image_url: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/update',
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: 'Unauthorized' };
      }
      const { gameId, version, manifestUrl, zipUrl, downloadUrl, latestVersion } = body;
      const finalVersion = version || latestVersion;
      const finalZipUrl = zipUrl || downloadUrl;

      if (!gameId || !finalVersion) {
        set.status = 400;
        return { message: 'Missing required fields: gameId, version' };
      }

      try {
        await GamesService.updateGameVersion(
          gameId,
          finalVersion,
          manifestUrl || '',
          finalZipUrl || ''
        );
        return { success: true };
      } catch (err: any) {
        set.status = 500;
        return { message: err.message };
      }
    },
    {
      body: t.Object({
        gameId: t.String(),
        version: t.Optional(t.String()),
        latestVersion: t.Optional(t.String()),
        manifestUrl: t.Optional(t.String()),
        zipUrl: t.Optional(t.String()),
        downloadUrl: t.Optional(t.String()),
      }),
    }
  )
  .post('/:id/install', async ({ params: { id }, user, set }) => {
    try {
      const userId = user ? (user as any).id : ''; // Pass empty string if no user, service checks it. Or explicit null.
      return await GamesService.installGame(id, userId);
    } catch (err: any) {
      set.status = 500;
      return { message: err.message };
    }
  });
