import { defineStore } from 'pinia';
import axios from 'axios';

export const useCategoryStore = defineStore('category', {
  state: () => ({
    categories: [] as any[],
    isLoading: false,
  }),
  actions: {
    async fetchCategories() {
      this.isLoading = true;
      try {
        const response = await axios.get('/game-categories');
        this.categories = response.data || [];
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        this.categories = [];
      } finally {
        this.isLoading = false;
      }
    },
    async createCategory(name: string, icon: string = '') {
      try {
        const response = await axios.post('/game-categories', { name, icon });
        await this.fetchCategories();
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async deleteCategory(categoryId: string) {
      try {
        await axios.delete(`/game-categories/${categoryId}`);
        await this.fetchCategories();
      } catch (error) {
        throw error;
      }
    },
    async assignGameToCategory(categoryId: string, gameKey: string) {
      try {
        await axios.post(`/game-categories/${categoryId}/assign`, { gameKey });
        await this.fetchCategories();
      } catch (error) {
        throw error;
      }
    },
  },
});
