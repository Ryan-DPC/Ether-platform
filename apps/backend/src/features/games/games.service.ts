
import Games, { GameModel } from './game.model';
import { CloudinaryService } from '../../services/cloudinary.service';
import { GitHubService } from '../../services/github.service';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import unzipper from 'unzipper';

import { redisService } from '../../services/redis.service';
import { GameInstallationModel } from '@vext/database';

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

        const allGamesMap = new Map<string, any>();

        // 2. Fetch from Cloudinary (if enabled)
        try {
            const cloudinaryService = new CloudinaryService();
            if (cloudinaryService.isEnabled()) {
                console.log('[Games] Fetching games metadata from Cloudinary...');
                const cloudGames = await cloudinaryService.getAllGames();
                cloudGames.forEach((g: any) => allGamesMap.set(g.folder_name, g));
            }
        } catch (cloudError: any) {
            console.error('[Games] Cloudinary fetch failed (Rate Limit?), proceeding with DB only:', cloudError.message);
        }

        // 3. Fetch from DB
        try {
            console.log('[Games] Fetching games from MongoDB...');
            const dbGames = await GameModel.find().lean();
            dbGames.forEach((g: any) => {
                const formatted = { id: g._id.toString(), ...g };
                // DB takes precedence or merges? 
                // If it exists in Cloudinary, we might want to keep Cloudinary assets but override status?
                // For now, let's have DB override Cloudinary as it's the "source of truth" for new system.
                allGamesMap.set(g.folder_name, formatted);
            });
        } catch (dbError: any) {
            console.error('[Games] MongoDB fetch failed:', dbError.message);
        }

        const mergedGames = Array.from(allGamesMap.values());

        // 4. Cache Merged Results
        try {
            await redisService.setWithTTL(cacheKey, JSON.stringify(mergedGames));
        } catch (e) { }

        return mergedGames;
    }

    static async getGameDetails(folderName: string, userId: string | null = null) {
        const cacheKey = `game:details:${folderName}`;

        // 1. Try Cache
        try {
            const cached = await redisService.get(cacheKey);
            if (cached) {
                const cachedGame = JSON.parse(cached);
                return {
                    game: cachedGame,
                    userOwnsGame: true,
                    ownershipInfo: null
                };
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
        const result = await Games.addGame(gameData);
        // Invalidate 'games:all' cache to reflect new list
        try { await redisService.del('games:all'); } catch (e) { }
        return result;
    }

    static async updateGameVersion(gameId: string, version: string, manifestUrl: string, zipUrl: string) {
        const result = await Games.updateGameVersion(gameId, version, manifestUrl, zipUrl);
        // Invalidate specific game details and global list
        try {
            await Promise.all([
                redisService.del('games:all'),
                redisService.deletePattern(`game:details:*${gameId}*`) // Invalidate details for this game if name matches or just use pattern
            ]);
        } catch (e) { }
        return result;
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


    static async installGame(gameId: string, userId: string) {
        console.log(`[Games] Starting installation for ${gameId} (User: ${userId})...`);
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

        // Track Installation in DB
        if (userId) {
            try {
                // Find real Game ID (ObjectId)
                const gameDoc = await Games.getGameByName(gameId);
                const gameObjectId = gameDoc ? gameDoc._id || gameDoc.id : null;

                if (gameObjectId) {
                    await GameInstallationModel.findOneAndUpdate(
                        { user_id: userId, game_id: gameObjectId },
                        {
                            version: release.version,
                            path: gameDir,
                            status: 'installed',
                            last_checked: new Date()
                        },
                        { upsert: true, new: true }
                    );
                    console.log(`[Games] Installation recorded for user ${userId}`);
                }
            } catch (dbError: any) {
                console.error('[Games] Failed to save installation record:', dbError.message);
            }
        }

        return {
            success: true,
            version: release.version,
            path: gameDir
        };
    }
}
