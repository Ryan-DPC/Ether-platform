import { useUserStore } from '../stores/userStore';
import { useFriendsStore } from '../stores/friendsStore';
import { useAlertStore } from '../stores/alertStore';
import { useGameStore } from '../stores/gameStore'; // Optional if needed for ownership check or finding game by ID
import { statsService } from '../services/stats.service';
import tauriAPI from '../tauri-adapter';
import axios from 'axios';

export function useGameLauncher() {
  const userStore = useUserStore();
  const friendsStore = useFriendsStore();
  const alertStore = useAlertStore();

  // State for exposing progress/status if components want to bind to it
  // Note: Since multiple components might use this, state here defaults to local to the call unless we make it global.
  // For now, let's return refs that are local to the usage, but sync via Tauri events (which are global).
  // Actually, components usually maintain their own 'isInstalling' state based on listeners.
  // We will provide the Actions here.

  /**
   * Launch a game given its folder name (slug).
   * Automatically handles User Data, Tokens, Friends List, and Stats.
   */
  const launchGame = async (folderName: string, specificPath?: string) => {
    if (!(window as any).__TAURI__) {
      console.warn('Launch requested in non-Tauri environment');
      return;
    }

    try {
      let installPath = specificPath || localStorage.getItem('etherInstallPath');

      // Fallback: Check libraries if default path is missing
      if (!installPath) {
        const libraryPathsStr = localStorage.getItem('vextLibraryPaths');
        if (libraryPathsStr) {
          try {
            const paths = JSON.parse(libraryPathsStr);
            if (paths.length > 0) installPath = paths[0];
          } catch (e) {
            console.error('Error parsing library paths', e);
          }
        }
      }

      if (!installPath) {
        alertStore.showAlert({
          title: 'Configuration Error',
          message: 'Install path not configured. Please set a library path in Settings.',
          type: 'warning',
        });
        return;
      }

      // Prepare User Data
      const token = localStorage.getItem('token');
      const plainUser = userStore.user ? JSON.parse(JSON.stringify(userStore.user)) : null;
      const plainFriends = friendsStore.friends
        ? JSON.parse(JSON.stringify(friendsStore.friends))
        : [];

      const userData = { user: plainUser, token: token, friends: plainFriends };

      // Find game ID for stats (optional but recommended)
      // We might need to look it up from gameStore if we only have folderName
      // or pass it as an arg. For now, let's try to look it up if gameStore has it loaded.
      const gameStore = useGameStore();
      const game = gameStore.myGames.find(
        (g: any) => g.folder_name === folderName || g.slug === folderName
      );
      const gameId = game ? game._id || game.id : folderName; // Fallback to folderName if not found

      // 1. Start Session (Backend)
      await statsService.startSession(gameId);

      // 2. Launch (Tauri)
      await tauriAPI.launchGame(installPath, folderName, userData);
    } catch (error: any) {
      console.error('Launch Error:', error);
      alertStore.showAlert({
        title: 'Launch Error',
        message: `Failed to launch: ${error.message || String(error)}`,
        type: 'error',
      });
    }
  };

  /**
   * Install a game.
   * @param game The game object (must contain zipUrl/downloadUrl, folder_name/slug, game_name/gameName, version)
   * @param specificInstallPath Optional specific path (if user selected one via a dialog)
   */
  const installGame = async (game: any, specificInstallPath?: string | null) => {
    if (!(window as any).__TAURI__) {
      alertStore.showAlert({
        title: 'Error',
        message: 'Installation requires Desktop App',
        type: 'error',
      });
      return { success: false };
    }

    try {
      // Logic to determine path
      let installPath = specificInstallPath;

      if (!installPath) {
        // Check defaults
        installPath = localStorage.getItem('etherInstallPath');
        const libraryPathsStr = localStorage.getItem('vextLibraryPaths');

        // Smart fallback: if no default but libraries exist
        if (!installPath && libraryPathsStr) {
          const paths = JSON.parse(libraryPathsStr);
          if (paths.length > 0) installPath = paths[0];
        }
      }

      if (!installPath) {
        // If still no path, caller should have handled path selection UI
        // We return failure so UI can show selector
        return { success: false, reason: 'no_path' };
      }

      // Normalize Game Data
      const gameId = game._id || game.folder_name || game.slug;
      const folderName = game.folder_name || game.slug;
      let zipUrl = game.zipUrl || game.zip_url || game.downloadUrl || game.download_url;

      // If missing URL, try fetching details
      if (!zipUrl) {
        try {
          const details = await axios.get(`/games/details/${gameId}`);
          if (details.data && details.data.game) {
            const fullGame = details.data.game;
            zipUrl =
              fullGame.zipUrl || fullGame.zip_url || fullGame.downloadUrl || fullGame.download_url;
          }
        } catch (e) {
          console.error('Failed to fetch game details for install', e);
        }
      }

      if (!zipUrl) {
        throw new Error('Download URL not found for this game');
      }

      // Start Install
      await tauriAPI.installGame(
        zipUrl,
        installPath,
        folderName,
        gameId,
        game.game_name || game.gameName,
        game.version || game.latestVersion || '1.0.0',
        game // Pass full manifest/game object if needed
      );

      return { success: true, gameId: gameId, installPath };
    } catch (error: any) {
      alertStore.showAlert({
        title: 'Installation Error',
        message: error.message || 'Unknown installation error',
        type: 'error',
      });
      return { success: false, error };
    }
  };

  /**
   * Uninstall a game.
   */
  const uninstallGame = async (game: any) => {
    if (!(window as any).__TAURI__) return;

    const installPath = localStorage.getItem('etherInstallPath');
    if (!installPath) return; // TODO: Lookup actual install path if multi-library support

    const confirm = await alertStore.showConfirm({
      title: 'Uninstall Game',
      message: `Are you sure you want to uninstall ${game.game_name || game.gameName}?`,
      type: 'warning',
      confirmText: 'Uninstall',
      cancelText: 'Cancel',
    });

    if (!confirm) return;

    try {
      await tauriAPI.uninstallGame(installPath, game.folder_name || game.slug);
      alertStore.showAlert({
        title: 'Success',
        message: 'Game uninstalled successfully',
        type: 'success',
      });
      return true;
    } catch (e: any) {
      alertStore.showAlert({
        title: 'Error',
        message: `Uninstall failed: ${e.message || e}`,
        type: 'error',
      });
      return false;
    }
  };

  return {
    launchGame,
    installGame,
    uninstallGame,
  };
}
