import { defineStore } from 'pinia';
import axios from 'axios';
import { socketService } from '../services/socket';

interface Group {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  members: {
    id: string;
    username: string;
    profile_pic?: string;
    is_online?: boolean;
  }[];
  icon_url?: string;
  created_at: string;
  updated_at: string;
}

interface GroupMessage {
  id: string;
  group_id: string;
  user: {
    id: string;
    username: string;
    profile_pic?: string;
  };
  content: string;
  created_at: string;
}

export const useGroupStore = defineStore('groups', {
  state: () => ({
    myGroups: [] as Group[],
    activeGroupId: null as string | null,
    messages: {} as Record<string, GroupMessage[]>,
    isLoading: false,
  }),

  getters: {
    activeGroup: (state) => {
      if (!state.activeGroupId) return null;
      return state.myGroups.find((g) => g.id === state.activeGroupId) || null;
    },
    activeMessages: (state) => {
      if (!state.activeGroupId) return [];
      return state.messages[state.activeGroupId] || [];
    },
  },

  actions: {
    async fetchMyGroups() {
      this.isLoading = true;
      try {
        const response = await axios.get('/groups/my-groups');
        this.myGroups = response.data;
      } catch (error) {
        console.error('Failed to fetch groups:', error);
        this.myGroups = [];
      } finally {
        this.isLoading = false;
      }
    },

    async createGroup(name: string, description?: string, iconUrl?: string) {
      try {
        const response = await axios.post('/groups/create', {
          name,
          description,
          iconUrl,
        });

        if (response.data.success) {
          await this.fetchMyGroups();
          return response.data.group;
        }
      } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to create group');
      }
    },

    async selectGroup(groupId: string) {
      this.activeGroupId = groupId;

      // Fetch messages if not already loaded
      if (!this.messages[groupId]) {
        await this.fetchMessages(groupId);
      }

      // Join WebSocket room
      socketService.emit('group:join', { groupId });
    },

    async fetchMessages(groupId: string) {
      try {
        const response = await axios.get(`/groups/${groupId}/messages`);
        this.messages[groupId] = response.data;
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        this.messages[groupId] = [];
      }
    },

    sendMessage(content: string) {
      if (!this.activeGroupId) return;

      socketService.emit('group:send-message', {
        groupId: this.activeGroupId,
        content,
      });
    },

    async inviteMember(groupId: string, friendId: string) {
      try {
        await axios.post(`/groups/${groupId}/invite`, { friendId });
        return true;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to invite member');
      }
    },

    async leaveGroup(groupId: string) {
      try {
        await axios.post(`/groups/${groupId}/leave`);

        // Leave WebSocket room
        socketService.emit('group:leave', { groupId });

        // Remove group from list
        this.myGroups = this.myGroups.filter((g) => g.id !== groupId);

        if (this.activeGroupId === groupId) {
          this.activeGroupId = null;
        }
      } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to leave group');
      }
    },

    async deleteGroup(groupId: string) {
      try {
        await axios.delete(`/groups/${groupId}`);
        this.myGroups = this.myGroups.filter((g) => g.id !== groupId);

        if (this.activeGroupId === groupId) {
          this.activeGroupId = null;
        }
      } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to delete group');
      }
    },

    // WebSocket event handlers
    handleMessageReceived(message: GroupMessage) {
      const groupId = message.group_id;
      if (!this.messages[groupId]) {
        this.messages[groupId] = [];
      }
      this.messages[groupId].push(message);
    },

    setupWebSocketListeners() {
      socketService.on('group:message-received', (data: GroupMessage) => {
        this.handleMessageReceived(data);
      });

      socketService.on('group:member-joined', (data: any) => {
        console.log('Member joined:', data);
        // Optionally refresh group details
      });

      socketService.on('group:member-left', (data: any) => {
        console.log('Member left:', data);
        // Optionally refresh group details
      });
    },
  },
});
