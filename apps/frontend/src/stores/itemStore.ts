import { defineStore } from 'pinia';
import axios from 'axios';
import { useUserStore } from './userStore';

export const useItemStore = defineStore('item', {
  state: () => ({
    storeItems: [] as any[],
    myItems: [] as any[],
    isLoading: false,
  }),
  actions: {
    async fetchStoreItems(filters: any = {}, force = false) {
      if (!force && this.storeItems.length > 0 && Object.keys(filters).length === 0) return;
      this.isLoading = true;
      try {
        const params = new URLSearchParams();
        if (filters.type) params.set('type', filters.type);
        if (filters.rarity) params.set('rarity', filters.rarity);

        const response = await axios.get(`/items/store?${params}`);
        // Handle both array response and { items: [] } response structure
        if (Array.isArray(response.data)) {
          this.storeItems = response.data;
        } else {
          this.storeItems = response.data.items || [];
        }
      } catch (error) {
        console.error('Failed to fetch store items:', error);
        this.storeItems = [];
      } finally {
        this.isLoading = false;
      }
    },
    async fetchMyItems() {
      try {
        const response = await axios.get('/items/my-items');
        // Backend returns array directly, not wrapped
        this.myItems = Array.isArray(response.data) ? response.data : response.data.items || [];
      } catch (error) {
        console.error('Failed to fetch my items:', error);
        this.myItems = [];
      }
    },
    async purchaseItem(itemId: string) {
      try {
        const response = await axios.post('/items/purchase', { itemId });
        await this.fetchMyItems();
        await this.fetchStoreItems({}, true); // Force refresh to update 'owned' status

        // Update user tokens immediately
        const userStore = useUserStore();
        if (response.data.remainingTokens !== undefined) {
          userStore.setTokens(response.data.remainingTokens);
        }

        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async equipItem(itemId: string) {
      try {
        const response = await axios.post('/items/equip', { itemId });
        await this.fetchMyItems();

        // If profile picture was equipped, update user profile to sync avatar
        if (response.data.profile_pic_url) {
          const userStore = useUserStore();
          await userStore.fetchProfile();
        }

        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async unequipItem(itemId: string) {
      try {
        const response = await axios.post('/items/unequip', { itemId });
        await this.fetchMyItems();
        return response.data;
      } catch (error) {
        throw error;
      }
    },
  },
});
