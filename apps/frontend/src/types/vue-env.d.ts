/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

export interface ElectronAPI {
  // Folder picker
  selectFolder: () => Promise<string | null>;

  // App info
  getVersion: () => Promise<string>;
  getPath: (name: string) => Promise<string>;
  isElectron: () => Promise<boolean>;

  // Installation
  installGame: (
    zipUrl: string,
    installPath: string,
    gameFolderName: string,
    gameId: string,
    gameName: string,
    version: string
  ) => Promise<{ success: boolean; message: string }>;
  getInstallStatus: (gameId: string) => Promise<{ status: string }>;
  cancelInstall: (gameId: string) => Promise<{ success: boolean; error?: string }>;
  checkGameInstalled: (installPath: string, gameFolderName: string) => Promise<boolean>;
  uninstallGame: (installPath: string, gameFolderName: string) => Promise<{ success: boolean }>;

  closeGame: (gameId: string) => Promise<{ success: boolean; message: string }>;

  // Installation events
  onInstallProgress: (callback: (data: any) => void) => void;
  onInstallComplete: (callback: (data: any) => void) => void;
  onInstallError: (callback: (data: any) => void) => void;

  // Game Launcher
  launchGame: (
    installPath: string,
    gameFolderName: string
  ) => Promise<{ success: boolean; message: string; gameId?: string }>;
  getActiveGames: () => Promise<
    Array<{
      gameId: string;
      gameName: string;
      startTime: number;
      type: 'window' | 'process';
    }>
  >;

  // Platform info
  platform: string;
  isDevelopment: boolean;
}

declare global {
  interface Window {}
}
