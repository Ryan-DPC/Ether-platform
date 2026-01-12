import { defineStore } from 'pinia';
import axios from 'axios';

export interface LobbyPlayer {
  userId: string;
  username: string;
  profile_pic: string;
  isHost: boolean;
}

export interface Lobby {
  id: string;
  gameId: string;
  gameName: string;
  hostId: string;
  players: LobbyPlayer[];
  maxPlayers: number;
  createdAt: string;
}

export const useLobbyStore = defineStore('lobby', {
  state: () => ({
    currentLobby: null as Lobby | null,
    pendingInvites: [] as Array<{ lobbyId: string; fromUserId: string; fromUsername: string }>,
    loading: false,
  }),

  getters: {
    isInLobby: (state) => state.currentLobby !== null,
    isHost: (state) => {
      if (!state.currentLobby) return false;
      // Compare with current user ID from userStore
      return state.currentLobby.hostId === state.currentLobby.players[0]?.userId;
    },
  },

  actions: {
    async createLobby(gameId: string, gameName: string) {
      this.loading = true;
      try {
        const response = await axios.post('/lobby/create', { gameId, gameName });
        this.currentLobby = response.data.lobby;
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to create lobby');
      } finally {
        this.loading = false;
      }
    },

    async joinLobby(lobbyId: string) {
      this.loading = true;
      try {
        const response = await axios.post('/lobby/join', { lobbyId });
        this.currentLobby = response.data.lobby;
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to join lobby');
      } finally {
        this.loading = false;
      }
    },

    async leaveLobby() {
      if (!this.currentLobby) return;

      this.loading = true;
      try {
        await axios.post('/lobby/leave', { lobbyId: this.currentLobby.id });
        this.currentLobby = null;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to leave lobby');
      } finally {
        this.loading = false;
      }
    },

    updateLobbyPlayers(players: LobbyPlayer[]) {
      if (this.currentLobby) {
        this.currentLobby.players = players;
      }
    },

    addInvite(lobbyId: string, fromUserId: string, fromUsername: string) {
      this.pendingInvites.push({ lobbyId, fromUserId, fromUsername });
    },

    removeInvite(lobbyId: string) {
      this.pendingInvites = this.pendingInvites.filter((i) => i.lobbyId !== lobbyId);
    },

    setLobby(lobby: Lobby | null) {
      this.currentLobby = lobby;
    },
  },
});
