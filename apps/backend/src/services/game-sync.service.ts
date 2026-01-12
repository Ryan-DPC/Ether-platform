
import fs from 'fs'; // Bun uses node:fs or fs usually works
import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

// Note: 'archiver' is not installed by default in this project.
// If zipping is required, please install 'archiver' and uncomment appropriate lines.
// import archiver from 'archiver'; 

export class GameSyncService {
    static devGamesPath = process.env.DEV_GAMES_PATH || path.join(__dirname, '../../../../me');
    static slugFile = path.join(GameSyncService.devGamesPath, 'slug.json');
    static syncCache = new Map<string, any>();

    static async calculateChecksum(filePath: string) {
        // Using fs.promises for async
        const fileBuffer = await fs.promises.readFile(filePath);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    }

    static async calculateDirChecksum(dirPath: string) {
        const files = await this.getAllFiles(dirPath);
        const checksums = await Promise.all(
            files.map(file => this.calculateChecksum(file))
        );
        return crypto.createHash('sha256').update(checksums.join('')).digest('hex');
    }

    static async getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
        try {
            const files = await fs.promises.readdir(dirPath);

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = await fs.promises.stat(filePath);

                if (stat.isDirectory()) {
                    if (!['node_modules', '.git', 'dist', 'build'].includes(file)) {
                        await this.getAllFiles(filePath, arrayOfFiles);
                    }
                } else {
                    arrayOfFiles.push(filePath);
                }
            }
        } catch (e) {
            // Directory might not exist
        }
        return arrayOfFiles;
    }

    static async getDevGames() {
        try {
            const slugData = await fs.promises.readFile(this.slugFile, 'utf8');
            const data = JSON.parse(slugData);
            return data.games || {};
        } catch (error) {
            console.error('Error reading slug.json:', error);
            return {};
        }
    }

    static async needsSync(gameSlug: string, gamePath: string) {
        try {
            const manifestPath = path.join(gamePath, 'manifest.json');
            try {
                await fs.promises.access(manifestPath);
            } catch {
                console.log(`No manifest found for ${gameSlug}, skipping`);
                return false;
            }

            const manifestChecksum = await this.calculateChecksum(manifestPath);
            const dirChecksum = await this.calculateDirChecksum(gamePath);
            const combinedChecksum = crypto.createHash('sha256')
                .update(manifestChecksum + dirChecksum)
                .digest('hex');

            const cached = this.syncCache.get(gameSlug);
            if (cached && cached.checksum === combinedChecksum) {
                console.log(`${gameSlug}: No changes detected`);
                return false;
            }

            this.syncCache.set(gameSlug, {
                checksum: combinedChecksum,
                lastSync: new Date()
            });

            return true;
        } catch (error) {
            console.error(`Error checking sync for ${gameSlug}:`, error);
            return false;
        }
    }

    static async zipGame(gamePath: string, outputPath: string) {
        console.warn('Zip functionality requires "archiver" package. Skipping zip creation.');
        // Placeholder for zip logic
        // return new Promise((resolve, reject) => {
        //     const output = fs.createWriteStream(outputPath);
        //     const archive = archiver('zip', { zlib: { level: 9 } });
        //     output.on('close', () => resolve(outputPath));
        //     archive.on('error', reject);
        //     archive.pipe(output);
        //     archive.glob('**/*', { cwd: gamePath, ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '*.log'] });
        //     archive.finalize();
        // });
        return outputPath;
    }

    static async findGameImage(gamePath: string) {
        const possibleNames = ['logo.png', 'game.png', 'icon.png', 'cover.png', 'image.png'];
        for (const name of possibleNames) {
            const imagePath = path.join(gamePath, name);
            try {
                await fs.promises.access(imagePath);
                return { path: imagePath, name };
            } catch { }
        }
        return null;
    }

    static async uploadFileToCloudinary(filePath: string, publicId: string, resourceType: 'raw' | 'image' = 'raw') {
        try {
            // Check if file exists before upload (zip might not exist if we skipped it)
            try {
                await fs.promises.access(filePath);
            } catch {
                if (resourceType === 'raw' && filePath.endsWith('.zip')) {
                    console.warn(`File ${filePath} does not exist (zip skipped), skipping upload.`);
                    return { secure_url: 'skipped_zip', bytes: 0 };
                }
                throw new Error(`File not found: ${filePath}`);
            }

            const result = await cloudinary.uploader.upload(filePath, {
                resource_type: resourceType,
                public_id: publicId,
                overwrite: true
            });
            return result;
        } catch (error: any) {
            console.error(`  ✗ Failed to upload ${publicId}:`, error.message);
            throw error;
        }
    }

    static async syncGame(gameSlug: string, gamePath: string) {
        try {
            console.log(`\n========== Syncing: ${gameSlug} ==========`);
            if (!await this.needsSync(gameSlug, gamePath)) {
                return { success: true, skipped: true, game: gameSlug };
            }

            const manifestPath = path.join(gamePath, 'manifest.json');
            const results: any = {
                success: true,
                game: gameSlug,
                manifest: null,
                image: null,
                zip: null,
                timestamp: new Date()
            };

            // 1. Upload manifest
            try {
                const manifestResult = await this.uploadFileToCloudinary(manifestPath, `games/dev/${gameSlug}/manifest`, 'raw');
                results.manifest = manifestResult.secure_url;
            } catch (error) {
                // If manifest fails, we can't continue
                throw error;
            }

            // 2. Upload Image
            const gameImage = await this.findGameImage(gamePath);
            if (gameImage) {
                try {
                    const imageResult = await this.uploadFileToCloudinary(gameImage.path, `games/dev/${gameSlug}/image`, 'image');
                    results.image = imageResult.secure_url;
                } catch (e) { }
            }

            // 3. Zip and Upload
            // Skipping real zip for now
            const tempDir = path.join(__dirname, '../../../../temp');
            // await fs.promises.mkdir(tempDir, { recursive: true });
            const zipPath = path.join(tempDir, `${gameSlug}.zip`);

            // await this.zipGame(gamePath, zipPath);

            // const zipResult = await this.uploadFileToCloudinary(zipPath, `games/dev/${gameSlug}/${gameSlug}`, 'raw');
            // results.zip = zipResult.secure_url;
            // results.size = zipResult.bytes;
            results.zip = "zip_functionality_disabled_missing_archiver";

            // try { await fs.promises.unlink(zipPath); } catch {}

            return results;
        } catch (error: any) {
            return { success: false, game: gameSlug, error: error.message };
        }
    }

    static async syncAllGames(force = false) {
        if (force) this.syncCache.clear();

        const devGames = await this.getDevGames();
        const results = [];

        for (const [slug, gameInfo] of Object.entries(devGames)) {
            const gamePath = path.join(this.devGamesPath, slug);
            // Verify path exists
            try {
                await fs.promises.access(gamePath);
                const result = await this.syncGame(slug, gamePath);
                results.push(result);
            } catch {
                results.push({ success: false, game: slug, error: 'Directory not found' });
            }
        }
        return { success: true, results, timestamp: new Date() };
    }
}
