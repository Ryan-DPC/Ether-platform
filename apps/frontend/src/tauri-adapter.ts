import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Define the interface match existing usage if possible, or just strict typing
interface TauriAPI {
  selectFolder: () => Promise<string | null>;
  installGame: (
    downloadUrl: string,
    installPath: string,
    folderName: string,
    gameId: string,
    gameName: string,
    version: string,
    manifest: any
  ) => Promise<any>;
  checkGameInstalled: (installPath: string, folderName: string) => Promise<boolean>;
  uninstallGame: (installPath: string, folderName: string) => Promise<boolean>;
  launchGame: (installPath: string, folderName: string, userData: any) => Promise<any>;
  onInstallProgress: (callback: (data: any) => void) => void;
  onInstallComplete: (callback: (data: any) => void) => void;
  onInstallError: (callback: (data: any) => void) => void;
  onGameStatus: (callback: (data: any) => void) => void;
  onGameExited: (callback: (data: any) => void) => void;
}

const tauriAPI: TauriAPI = {
  // ... existing methods ...
  selectFolder: async () => {
    if (!(window as any).__TAURI_INTERNALS__) return null;
    try {
      const selected = await invoke('select_folder');
      return selected as string | null;
    } catch (e) {
      console.warn('Tauri invoke failed:', e);
      return null;
    }
  },

  installGame: async (
    downloadUrl,
    installPath,
    folderName,
    gameId,
    gameName,
    _version,
    _manifest
  ) => {
    if (!(window as any).__TAURI_INTERNALS__) throw new Error('Not running in Tauri');
    try {
      return await invoke('install_game', {
        downloadUrl,
        installPath,
        folderName,
        gameId,
        gameName,
      });
    } catch (e: any) {
      throw e;
    }
  },

  checkGameInstalled: (installPath, folderName) => {
    if (!(window as any).__TAURI_INTERNALS__) return Promise.resolve(false);
    return invoke('is_game_installed', { installPath, folderName });
  },

  uninstallGame: (installPath, folderName) => {
    if (!(window as any).__TAURI_INTERNALS__) return Promise.resolve(false);
    return invoke('uninstall_game', { installPath, folderName });
  },

  launchGame: (installPath, folderName, userData) => {
    if (!(window as any).__TAURI_INTERNALS__) return Promise.reject('Not running in Tauri');
    return invoke('launch_game', { installPath, folderName, userData });
  },

  onInstallProgress: (callback) => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    listen('install:progress', (event: any) => {
      callback(event.payload);
    }).catch((e) => console.warn('Failed to listen to install:progress', e));
  },
  onInstallComplete: (callback) => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    listen('install:complete', (event: any) => {
      callback(event.payload);
    }).catch((e) => console.warn('Failed to listen to install:complete', e));
  },
  onInstallError: (callback) => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    listen('install:error', (event: any) => {
      callback(event.payload);
    }).catch((e) => console.warn('Failed to listen to install:error', e));
  },
  onGameStatus: (callback) => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    listen('game:status', (event: any) => {
      callback(event.payload);
    }).catch((e) => console.warn('Failed to listen to game:status', e));
  },
  onGameExited: (callback) => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    listen('game:exited', (event: any) => {
      callback(event.payload);
    }).catch((e) => console.warn('Failed to listen to game:exited', e));
  },
};

export default tauriAPI;
