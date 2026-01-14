import { defineStore } from 'pinia';
import axios from 'axios';

export interface Friend {
  id: string;
  username: string;
  profile_pic: string;
  elo: number;
  status: 'online' | 'offline' | 'in-game';
  currentLobby?: string;
}

export interface FriendRequest {
  request_id: string;
  user_id: string;
  username: string;
  profile_pic: string;
}

export const useFriendsStore = defineStore('friends', {
  state: () => ({
    friends: [] as Friend[],
    friendRequests: [] as FriendRequest[],
    isPopupOpen: false,
    selectedFriend: null as Friend | null,
    loading: false,
  }),

  actions: {
    async fetchFriends() {
      this.loading = true;
      try {
        const response = await axios.get('/friends/list');
        this.friends = response.data.friends || [];
      } catch (error) {
        console.error('Failed to fetch friends:', error);
      } finally {
        this.loading = false;
      }
    },

    async fetchFriendRequests() {
      try {
        const response = await axios.get('/friends/requests');
        this.friendRequests = response.data.requests || [];
      } catch (error) {
        console.error('Failed to fetch friend requests:', error);
      }
    },

    async sendFriendRequest(username: string) {
      try {
        // First, search for the user by username to get their ID
        const searchResponse = await axios.get(
          `/users/search?q=${encodeURIComponent(username)}`
        );

        const data = searchResponse.data;
        const users = Array.isArray(data) ? data : (data.users || []);

        if (!users || users.length === 0) {
          throw new Error('Utilisateur introuvable');
        }

        const targetUser = users[0];

        // Then send friend request with the user ID
        const response = await axios.post('/friends/add', { friendId: targetUser.id });
        return response.data;
      } catch (error: any) {
        if (error.message === 'Utilisateur introuvable') {
          throw error;
        }
        throw new Error(error.response?.data?.message || 'Failed to send friend request');
      }
    },

    async acceptFriendRequest(requestId: string) {
      try {
        await axios.post('/friends/accept', { requestId });
        await this.fetchFriendRequests();
        await this.fetchFriends();
      } catch (error) {
        console.error('Failed to accept friend request:', error);
        throw error;
      }
    },

    async rejectFriendRequest(requestId: string) {
      try {
        await axios.post(`/friends/reject/${requestId}`);
        await this.fetchFriendRequests();
      } catch (error) {
        console.error('Failed to reject friend request:', error);
        throw error;
      }
    },

    async removeFriend(friendId: string) {
      try {
        await axios.delete(`/friends/${friendId}`);
        await this.fetchFriends();
      } catch (error) {
        console.error('Failed to remove friend:', error);
        throw error;
      }
    },

    updateFriendStatus(userId: string, status: 'online' | 'offline' | 'in-game', lobbyId?: string) {
      const friend = this.friends.find((f) => f.id === userId);
      if (friend) {
        friend.status = status;
        friend.currentLobby = lobbyId;
      }
    },

    togglePopup() {
      this.isPopupOpen = !this.isPopupOpen;
    },

    selectFriend(friend: Friend | null) {
      this.selectedFriend = friend;
    },
  },
});
