
import Games, { GameModel } from './game.model';
import { CloudinaryService } from '../../services/cloudinary.service';
import { GitHubService } from '../../services/github.service';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import unzipper from 'unzipper';

import { redisService } from '../../services/redis.service';

// Using redisService instead of mock
const logger = console;

export class GamesService {
    static async getAllGames() {
        const cacheKey = 'games:all';

        // 1. Try Redis Cache
        try {
            const cached = await redisService.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e: any) {
            console.warn('[Games] Redis read error:', e.message);
        }

        // 2. Try Fetch from Cloudinary
        try {
            const cloudinaryService = new CloudinaryService();
            if (cloudinaryService.isEnabled()) {
                console.log('[Games] Fetching games metadata from Cloudinary...');
                const games = await cloudinaryService.getAllGames();

                // Save to Redis (1 hour TTL)
                try {
                    await redisService.set(cacheKey, JSON.stringify(games), { EX: 3600 });
                } catch (e) { }

                return games;
            } else {
                console.warn('[Games] Cloudinary disabled, returning DB games only.');
            }
        } catch (cloudError: any) {
            console.error('[Games] Cloudinary fetch failed (Rate Limit?), falling back to DB:', cloudError.message);
            // Fallback to DB
        }

        // 3. Fallback to DB
        return await Games.getAllGames();
    }

    static async getGameDetails(folderName: string, userId: string | null = null) {
        const cacheKey = `game:details:${folderName}`;

        // 1. Try Cache
        try {
            if (redisClient.isOpen) {
                const cached = await redisClient.get();
                if (cached) {
                    const cachedGame = JSON.parse(cached);
                    return {
                        game: cachedGame,
                        userOwnsGame: true,
                        ownershipInfo: null
                    };
                }
            }
        } catch (e: any) {
            console.warn('[Games] Cache read error:', e.message);
        }

        // 2. Get Metadata
        let game = await this.getGameByName(folderName);
        if (!game) {
            throw new Error('Game not found.');
        }

        // 3. Enhance with GitHub Info
        let latestRelease = null;
        if (game.github_url) {
            try {
                const ghService = new GitHubService();
                const repoInfo = ghService.parseUrl(game.github_url);
                if (repoInfo) {
                    latestRelease = await ghService.getLatestRelease(repoInfo.owner, repoInfo.repo);
                }
            } catch (ghError: any) {
                console.warn(`[Games] Failed to fetch GitHub info for ${folderName}:`, ghError.message);
            }
        }

        const enhancedGame = {
            ...game,
            version: latestRelease ? latestRelease.version : game.version,
            latestVersion: latestRelease ? latestRelease.version : game.version,
            downloadUrl: latestRelease ? latestRelease.downloadUrl : game.downloadUrl,
            releaseNotes: latestRelease ? latestRelease.changelog : '',
            publishedAt: latestRelease ? latestRelease.publishedAt : game.updated_at
        };

        // 4. Save to Cache
        // Stubbed for now

        return {
            game: enhancedGame,
            userOwnsGame: true,
            ownershipInfo: null
        };
    }

    static async getGameByName(idOrName: string) {
        const allGames = await this.getAllGames();
        const game = allGames.find((g: any) => g.id === idOrName || g.folder_name === idOrName);
        if (game) return game;
        return await Games.getGameByName(idOrName);
    }

    static async addGame(gameData: any) {
        return await Games.addGame(gameData);
    }

    static async updateGameVersion(gameId: string, version: string, manifestUrl: string, zipUrl: string) {
        return await Games.updateGameVersion(gameId, version, manifestUrl, zipUrl);
    }

    static async getManifestUrl(folderName: string) {
        // Implementation based on original controller/routes logic if it existed,
        // but it looks like it just returns a generic URL or similar?
        // Original controller says: await GamesService.getManifestUrl(folder_name);
        // But original GamesService source provided earlier did NOT have getManifestUrl method visible!
        // It must have been added or involved another service. 
        // Based on routes.js: router.get('/:id/manifest-url', ...);
        // Let's implement a logical fallback.
        const game = await this.getGameByName(folderName);
        if (!game) throw new Error('Game not found');
        return game.manifestUrl;
    }

    static async getManifest(id: string) {
        const game = await this.getGameByName(id);
        if (!game) {
            throw new Error('Game not found');
        }

        if (!game.github_url) {
            // Check DB explicitly if Cloudinary missed it
            const dbGame = await Games.getGameByName(id);
            if (dbGame && dbGame.github_url) {
                game.github_url = dbGame.github_url;
            }
        }

        if (!game.github_url) {
            return {
                gameName: game.game_name || game.name,
                version: game.version || '1.0.0',
                description: game.description,
                platform: 'windows',
                entryPoint: game.entryPoint || 'Game.exe',
                downloadUrl: game.zipUrl || game.downloadUrl
            };
        }

        try {
            const ghService = new GitHubService();
            const repoInfo = ghService.parseUrl(game.github_url);

            if (!repoInfo) {
                return {
                    gameName: game.game_name || game.name,
                    version: game.version || '0.0.0',
                    description: game.description,
                    platform: 'windows',
                    entryPoint: game.entryPoint || 'Game.exe',
                    downloadUrl: null
                };
            }

            const release = await ghService.getLatestRelease(repoInfo.owner, repoInfo.repo);

            return {
                gameName: game.game_name || game.name,
                version: release!.version,
                description: game.description,
                platform: 'windows',
                entryPoint: game.entryPoint || 'Game.exe',
                downloadUrl: release!.downloadUrl,
                zipUrl: release!.downloadUrl,
                releaseNotes: release!.changelog,
                publishedAt: release!.publishedAt
            };

        } catch (error: any) {
            console.error(`[Manifest] Failed to fetch GitHub release for ${id}:`, error.message);
            return {
                gameName: game.game_name || game.name,
                version: game.version || '0.0.0',
                description: game.description,
                platform: 'windows',
                entryPoint: game.entryPoint || 'Game.exe',
                downloadUrl: game.zipUrl || null,
                error: 'Failed to fetch latest release info'
            };
        }
    }

    static async installGame(gameId: string) {
        console.log(`[Games] Starting installation for ${gameId}...`);
        const game = await this.getGameByName(gameId);
        if (!game || !game.github_url) {
            throw new Error(`Game ${gameId} not found or missing GitHub URL.`);
        }

        const ghService = new GitHubService();
        const repoInfo = ghService.parseUrl(game.github_url);
        if (!repoInfo) throw new Error(`Invalid GitHub URL: ${game.github_url}`);

        const release = await ghService.getLatestRelease(repoInfo.owner, repoInfo.repo);
        if (!release || !release.downloadUrl) {
            throw new Error(`No release or download URL found for ${gameId}`);
        }

        console.log(`[Games] Found release ${release.version} for ${gameId}. Downloading...`);

        // Use relative path from project root for portability in dev
        // Original: ../../../../games
        // backend-elysia/src/features/games -> ../../../../games
        const gamesPath = process.env.GAMES_PATH || path.resolve(process.cwd(), '../../../../games');
        const extension = release.downloadUrl.endsWith('.exe') ? '.exe' : '.zip';
        const tempPath = path.join(gamesPath, 'temp', `${gameId}_${release.version}${extension}`);

        await ghService.downloadFile(release.downloadUrl, tempPath);
        console.log(`[Games] Downloaded to ${tempPath}`);

        const gameDir = path.join(gamesPath, gameId);
        try {
            await fs.rm(gameDir, { recursive: true, force: true });
        } catch (e) { }
        await fs.mkdir(gameDir, { recursive: true });

        if (extension === '.zip') {
            console.log(`[Games] Extracting to ${gameDir}...`);
            // Using createRedStream from 'fs' not 'fs/promises'
            await new Promise<void>((resolve, reject) => {
                createReadStream(tempPath)
                    .pipe(unzipper.Extract({ path: gameDir }))
                    .on('close', resolve)
                    .on('error', reject);
            });
        } else {
            console.log(`[Games] Moving executable to ${gameDir}...`);
            const fileName = path.basename(release.downloadUrl);
            await fs.rename(tempPath, path.join(gameDir, fileName));
        }

        if (extension === '.zip') {
            await fs.unlink(tempPath);
        }

        console.log(`[Games] Installation complete for ${gameId} v${release.version}`);

        return {
            success: true,
            version: release.version,
            path: gameDir
        };
    }
}
