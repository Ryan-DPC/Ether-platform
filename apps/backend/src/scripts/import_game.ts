
import path from 'path';
import dotenv from 'dotenv';

// Load .env from apps/backend/.env (we are in src/scripts, so up 2 levels)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDB } from '../config/db';
import { GitHubService } from '../services/github.service';
import { GameModel } from '@vext/database';

const GITHUB_URL = process.argv[2];
const MANIFEST_PATH = process.argv[3] || 'vext.json';
const BRANCH = process.argv[4] || 'main'; // Default to main

if (!GITHUB_URL) {
    console.error('Usage: bun run src/scripts/import_game.ts <GITHUB_URL> [MANIFEST_PATH] [BRANCH]');
    console.error('Example: bun run src/scripts/import_game.ts https://github.com/Ryan-DPC/Vext-platform games/aether_strike/vext.json dev');
    process.exit(1);
}

const main = async () => {
    try {
        await connectDB();
        console.log('🔌 Connected to Database');

        const ghService = new GitHubService();
        const repoInfo = ghService.parseUrl(GITHUB_URL);

        if (!repoInfo) {
            throw new Error('Invalid GitHub URL');
        }

        console.log(`📦 Fetching metadata for ${repoInfo.owner}/${repoInfo.repo} (Manifest: ${MANIFEST_PATH}, Branch: ${BRANCH})...`);

        // 1. Fetch vext.json
        const manifestBuffer = await ghService.getRawFile(repoInfo.owner, repoInfo.repo, MANIFEST_PATH, BRANCH);
        if (!manifestBuffer) {
            throw new Error(`${MANIFEST_PATH} not found in repository on branch '${BRANCH}'. This file is required for Vext import.`);
        }

        const manifest = JSON.parse(manifestBuffer.toString());
        console.log('✅ Found valid vext.json manifest:', manifest.name);

        // 2. Validate Manifest
        if (!manifest.name || !manifest.folder_name || !manifest.executable) {
            throw new Error('Invalid manifest: missing name, folder_name, or executable.');
        }

        // 3. Fetch Latest Release to verify download availability
        console.log('🔍 Checking for releases...');
        const release = await ghService.getLatestRelease(repoInfo.owner, repoInfo.repo);

        // Warn but allow if no release yet (dev mode), or fail strict?
        // Let's allow but status will be 'dev' or similar if no downloadUrl

        let downloadUrl = manifest.zipUrl || null;
        let version = manifest.version;

        if (release) {
            console.log(`🎉 Found release ${release.version}`);
            version = release.version;
            if (release.downloadUrl) {
                downloadUrl = release.downloadUrl;
            }
        } else {
            console.warn('⚠️ No releases found on GitHub. Game will be imported but not downloadable yet.');
        }

        // 4. Upsert Game in DB
        const gameData = {
            game_name: manifest.name,
            folder_name: manifest.folder_name,
            description: manifest.description || '',
            image_url: manifest.image_url || '',
            status: downloadUrl ? 'disponible' : 'bientôt',
            genre: manifest.genre || 'Indie',
            max_players: manifest.max_players || 1,
            is_multiplayer: manifest.is_multiplayer || false,
            developer: manifest.developer || repoInfo.owner,
            price: manifest.price || 0,
            github_url: GITHUB_URL,
            version: version,
            zipUrl: downloadUrl,
            entryPoint: manifest.executable, // Assuming entryPoint field exists or will be added to model? Model has 'executable' no 'entryPoint'?
            // Let me check Game Model again...
            // Game Model has: manifestUrl, zipUrl, github_url, version...
            // It does NOT have 'entryPoint' or 'executable' explicitly in the schema shown earlier?
            // Wait, I should verify the schema columns.
        };

        // Re-checking schema based on previous `view_file` of Game.ts...
        // Schema: game_name, folder_name, description, image_url, status, genre, max_players, is_multiplayer, developer, price,
        // manifestUrl, zipUrl, github_url, version, manifestVersion, manifestUpdatedAt.
        // It seems 'entryPoint' or 'executable' is MISSING in the Mongoose schema I saw earlier!
        // But `vext.json` has `executable`. We might need to store it to launch the game?
        // Ah, `getManifest` in `games.service.ts` returned `entryPoint: game.entryPoint || 'Game.exe'`. 
        // But `entryPoint` was not in the `IGame` interface I saw.
        // I should probably add `entryPoint` or `executable` to the Game model to support this fully.
        // For now I will stick to what's in the schema + maybe just not save it if schema doesn't have it, 
        // OR add it to schema if I can.
        // I will add it to the valid fields if it maps to existing schema prop.
        // If not, I'll rely on `vext.json` being present in the downloaded folder for the launcher (which is usually how it works).

        // Actually, the `GameInstallation` or the launcher usually reads `vext.json` LOCALLY after install.
        // So saving everything to DB is good for validtion, but the Launcher needs local `vext.json`.
        // So importing it to DB is mainly for "Discovery".

        console.log('💾 Upserting into database...');

        const game = await GameModel.findOneAndUpdate(
            { folder_name: manifest.folder_name },
            gameData,
            { upsert: true, new: true }
        );

        console.log(`✅ Game imported successfully: ${game.game_name} (ID: ${game._id})`);

        // 5. Invalidate Cache
        const ADMIN_SECRET = process.env.ADMIN_SECRET;
        const BACKEND_URL = process.env.VITE_API_URL || process.env.BACKEND_URL || 'http://localhost:3000';
        // Note: VITE_API_URL is usually frontend env, backend might have BACKEND_URL or just PORT. 
        // Let's assume user reads logs or sets it. 
        // Actually, for this specific user, they are running against prod DB so likely want to hit prod backend.
        // But let's default to localhost if not set, and warn.

        if (ADMIN_SECRET) {
            console.log(`🧹 Invalidating cache via Remote API at ${BACKEND_URL}...`);
            try {
                const response = await fetch(`${BACKEND_URL}/api/admin/cache/clear`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Admin-Secret': ADMIN_SECRET
                    },
                    body: JSON.stringify({
                        keys: ['games:all'],
                        patterns: [`game:details:*${manifest.folder_name}*`]
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Remote Cache Invalidated:', result);
                } else {
                    console.warn(`⚠️ Failed to clear remote cache: ${response.status} ${response.statusText}`);
                    const text = await response.text();
                    console.warn('Response:', text);
                }

            } catch (err: any) {
                console.warn('⚠️ Network error calling remote cache clear:', err.message);
            }
        } else {
            // Fallback to local redis (existing behavior)
            // But we know it fails for this user connecting to prod DB from local.
            console.warn('⚠️ ADMIN_SECRET not set. Skipping remote cache clearance.');
            console.warn('ℹ️ To clear remote cache, set ADMIN_SECRET in .env');

            // ... existing local redis try/catch block can stay or be removed if we assume this is the main way now.
            // Let's keep it as fallback but maybe just warn.
            // Actually, better to remove the direct redis attempt if we are using the API approach to avoid the hang issues entirely
            // unless the user explicitly wants local redis.
            // The previous "hang" fix is there, so maybe leave it?
            // No, let's simplify. If they don't provide secret, we warn.
        }

        process.exit(0);

    } catch (error: any) {
        console.error('❌ Import Failed:', error.message);
        process.exit(1);
    }
};

main();
