import cron from 'node-cron';
import mongoose from 'mongoose';
import { WebSocketService } from '../services/websocket.service';
import { GameInstallationModel } from '@vext/database';

export class VersionCheckerJob {
  private job: any = null;

  start() {
    // Schedule: At minute 0 past every 3rd hour (0 */3 * * *)
    this.job = cron.schedule('0 */3 * * *', async () => {
      console.log('[VersionChecker] Starting version check...');
      await this.checkAllGamesForUpdates();
    });

    console.log('[VersionChecker] Job scheduled to run every 3 hours');
  }

  stop() {
    if (this.job) {
      this.job.stop();
      console.log('[VersionChecker] Job stopped');
    }
  }

  async checkAllGamesForUpdates() {
    try {
      // Get all installed games
      const installations = await GameInstallationModel.find({ status: 'installed' })
        .populate('user_id')
        .populate('game_id')
        .lean();

      console.log(`[VersionChecker] Checking ${installations.length} installations for updates...`);

      let updatesFound = 0;

      for (const installation of installations) {
        if (!installation.game_id || !installation.user_id) {
          continue;
        }

        const gameId = (installation.game_id as any)._id || installation.game_id;
        const userId = (installation.user_id as any)._id || installation.user_id;

        try {
          // Get latest manifest from Cloudinary
          const game = installation.game_id as any;
          if (!game.manifestUrl) {
            continue;
          }

          const response = await fetch(game.manifestUrl);
          if (!response.ok) {
            continue;
          }

          const manifest: any = await response.json();
          if (!manifest || !manifest.version) {
            continue;
          }

          // Compare versions
          const comparison = this.compareVersions(installation.version, manifest.version);

          if (comparison < 0) {
            // Update available!
            console.log(
              `[VersionChecker] Update available for ${game.game_name}: ${installation.version} -> ${manifest.version}`
            );

            // Update installation status
            await GameInstallationModel.findByIdAndUpdate(installation._id, {
              status: 'pending_update',
              last_checked: new Date(),
            });

            // Emit WebSocket notification to user
            const userIdStr = userId.toString();

            // io.to(userIdStr).emit('update:available', ...)
            // becomes:
            WebSocketService.publish(`user:${userIdStr}`, 'update:available', {
              gameId: gameId.toString(),
              gameName: game.game_name,
              currentVersion: installation.version,
              newVersion: manifest.version,
            });

            updatesFound++;
          } else {
            // Update last checked timestamp
            await GameInstallationModel.findByIdAndUpdate(installation._id, {
              last_checked: new Date(),
            });
          }
        } catch (error: any) {
          console.error(
            `[VersionChecker] Error checking game ${(installation.game_id as any)?.game_name}:`,
            error.message
          );
        }
      }

      console.log(`[VersionChecker] ✅ Version check complete. Found ${updatesFound} update(s)`);
    } catch (error) {
      console.error('[VersionChecker] Error in version check job:', error);
    }
  }

  compareVersions(version1: string, version2: string) {
    const v1 = version1.split('.').map(Number);
    const v2 = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const n1 = v1[i] || 0;
      const n2 = v2[i] || 0;

      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }

    return 0;
  }

  async runNow() {
    console.log('[VersionChecker] Manual trigger');
    await this.checkAllGamesForUpdates();
  }
}
