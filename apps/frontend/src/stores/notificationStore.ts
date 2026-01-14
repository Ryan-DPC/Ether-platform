import { defineStore } from 'pinia';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'invite';
  read: boolean;
  timestamp: Date;
  actionUrl?: string;
}

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    notifications: [
      {
        id: '1',
        title: 'Bienvenue !',
        message: 'Bienvenue sur VEXT. Commencez par explorer la boutique.',
        type: 'info',
        read: false,
        timestamp: new Date(),
        actionUrl: '/store',
      },

    ] as Notification[],
    isPopupOpen: false,
  }),

  getters: {
    unreadCount: (state) => state.notifications.filter((n) => !n.read).length,
  },

  actions: {
    togglePopup() {
      this.isPopupOpen = !this.isPopupOpen;
    },

    markAsRead(id: string) {
      const notification = this.notifications.find((n) => n.id === id);
      if (notification) {
        notification.read = true;
      }
    },

    markAllAsRead() {
      this.notifications.forEach((n) => (n.read = true));
    },

    addNotification(notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) {
      this.notifications.unshift({
        ...notification,
        id: Date.now().toString(),
        read: false,
        timestamp: new Date(),
      });
    },

    removeNotification(id: string) {
      this.notifications = this.notifications.filter((n) => n.id !== id);
    },
  },
});
