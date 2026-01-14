import { defineStore } from 'pinia';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
  action?: {
    label: string;
    callback: () => void;
  };
}

export const useToastStore = defineStore('toast', {
  state: () => ({
    toasts: [] as Toast[],
  }),

  actions: {
    addToast(toast: Omit<Toast, 'id'>) {
      // Deduplicate: Don't add if same message exists
      const existing = this.toasts.find(t => t.message === toast.message);
      if (existing) {
        // Optional: You could update a counter on the existing toast here
        return;
      }

      const id = Date.now().toString();
      const newToast = { ...toast, id };
      this.toasts.push(newToast);

      if (toast.duration !== 0) {
        setTimeout(() => {
          this.removeToast(id);
        }, toast.duration || 5000);
      }
    },

    removeToast(id: string) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },

    success(message: string) {
      this.addToast({ message, type: 'success' });
    },

    error(message: string) {
      this.addToast({ message, type: 'error' });
    },

    info(message: string) {
      this.addToast({ message, type: 'info' });
    },
  },
});
