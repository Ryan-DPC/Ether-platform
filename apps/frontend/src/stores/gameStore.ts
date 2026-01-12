import { defineStore } from 'pinia';
import axios from 'axios';

export const useGameStore = defineStore('game', {
  state: () => ({
    games: [] as any[],
    myGames: [] as any[],
    newGames: [] as any[],
    featuredGames: [] as any[],
    isLoading: false,
  }),
  getters: {
    getFilteredGames: (state) => (category: string) => {
      if (!category || category === 'trending') return state.games;
      if (category === 'new') return state.newGames;
      if (category === 'top')
        return [...state.games].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      return state.games.filter((g) => g.genre?.toLowerCase() === category.toLowerCase());
    },
  },
  actions: {
    async fetchHomeData() {
      this.isLoading = true;
      try {
        const response = await axios.get('/games/all');
        this.games = Array.isArray(response.data) ? response.data : response.data.games || [];
        this.newGames = response.data.newGames || [];

        // Populate featuredGames
        const featured = [...this.games];
        this.featuredGames = featured.slice(0, 4);
      } catch (error) {
        console.error('Failed to fetch home data:', error);
      } finally {
        this.isLoading = false;
      }
    },
    async fetchMyGames() {
      this.isLoading = true;
      try {
        const response = await axios.get('/library/my-games');
        this.myGames = response.data || [];
      } catch (error) {
        console.error('Failed to fetch my games:', error);
      } finally {
        this.isLoading = false;
      }
    },
  },
});
