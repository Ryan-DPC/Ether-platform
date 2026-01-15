import { NativeSocketService } from './native-socket';
import { useFriendsStore } from '../stores/friendsStore';
import { useLobbyStore } from '../stores/lobbyStore';
import { useToastStore } from '../stores/toastStore';
import { useUserStore } from '../stores/userStore';
import { useNotificationStore } from '../stores/notificationStore';
import { saveMessage } from './db';
import router from '../router';

// Get WebSocket URL based on environment
const getSocketUrl = () => {
  // Check environment variable first
  if (import.meta.env.VITE_WEBSOCKET_URL) {
    return import.meta.env.VITE_WEBSOCKET_URL;
  }

  const prodUrl = import.meta.env.VITE_WEBSOCKET_URL;
  const isTauri = !!(window as any).__TAURI__;

  let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'; // Default to Elysia port 3000

  // In Production or Tauri, use production server
  if (import.meta.env.PROD || isTauri) {
    if (prodUrl) {
      baseUrl = prodUrl;
    }
  }

  if (!baseUrl) {
    console.error('❌ WebSocket URL is undefined. Check .env variables.');
    return '';
  }

  // Strip trailing slash
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  // Strip /api if present, as WS is usually root/ws
  if (baseUrl.endsWith('/api')) {
    baseUrl = baseUrl.slice(0, -4);
  }

  // Convert http/https to ws/wss
  const wsUrl = baseUrl.replace('http', 'ws');
  return `${wsUrl}/ws`; // Append /ws path defined in backend
};

class SocketService {
  private socket: NativeSocketService | null = null;
  public isConnected = false;

  connect(token: string) {
    // If already connected, just mark as connected
    if (this.socket && this.isConnected) {
      console.log('✅ Already connected to WebSocket');
      return;
    }

    // Initialize socket connection to central WebSocket server
    const socketUrl = getSocketUrl();
    console.log('🔌 Connecting to socket:', socketUrl);

    // Re-use instance if exists but disconnnected, or create new
    if (!this.socket) {
      this.socket = new NativeSocketService(socketUrl);
    }

    // NativeSocketService handles auth via connect(token) which appends query param
    this.socket.connect(token);

    // Connection established
    this.socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
      this.isConnected = true;
    });

    // Disconnection handling
    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket server');
      this.isConnected = false;
    });

    // Connection errors
    this.socket.on('connect_error', (error: any) => {
      console.error('❌ Connection error:', error);
    });

    // Friend status updates
    this.socket.on('friend:status-changed', (data: any) => {
      console.log('📡 Friend status changed:', data);
      const friendsStore = useFriendsStore();
      friendsStore.updateFriendStatus(data.userId, data.status, data.lobbyId);
    });

    // Friend request notifications
    this.socket.on('friend:request-sent', (data: any) => {
      console.log('📡 Friend request received:', data);
      const friendsStore = useFriendsStore();
      friendsStore.fetchFriendRequests();

      const toastStore = useToastStore();
      toastStore.info('New friend request received');
    });

    this.socket.on('friend:request-accepted-notification', (data: any) => {
      console.log('📡 Friend request accepted:', data);
      const friendsStore = useFriendsStore();
      friendsStore.fetchFriends();

      const toastStore = useToastStore();
      toastStore.success('Friend request accepted');
    });

    // Lobby events
    this.socket.on('lobby:invite-received', (data: any) => {
      console.log('📡 Lobby invite received:', data);
      const lobbyStore = useLobbyStore();
      // data structure: { lobbyId, fromUserId, fromUsername }
      lobbyStore.addInvite(data.lobbyId, data.fromUserId, data.fromUsername);

      // Show toast
      const toastStore = useToastStore();
      toastStore.addToast({
        message: `${data.fromUsername} invited you to a lobby`,
        type: 'info',
        duration: 10000,
        action: {
          label: 'Join',
          callback: () => {
            lobbyStore.joinLobby(data.lobbyId);
            router.push('/lobby');
          },
        },
      });
    });

    this.socket.on('lobby:player-joined', (data: any) => {
      console.log('📡 Player joined lobby:', data);
      const lobbyStore = useLobbyStore();
      lobbyStore.updateLobbyPlayers(data.players);
    });

    this.socket.on('lobby:player-left', (data: any) => {
      console.log('📡 Player left lobby:', data);
      const lobbyStore = useLobbyStore();
      lobbyStore.updateLobbyPlayers(data.players);
    });

    // Chat events
    this.socket.on('chat:message-received', (data: any) => {
      console.log('📡 Chat message received:', data);

      // Save to local DB (Offline First)
      saveMessage({
        ...data,
        is_from_me: false,
        to_user_id: useUserStore().user?.id,
      }).catch((err) => console.error('Failed to save message to DB:', err));

      // Will be handled by Chat.vue component
      window.dispatchEvent(new CustomEvent('chat:new-message', { detail: data }));

      // Show toast if not on chat page with this user
      const currentRoute = router.currentRoute.value;
      const isChattingWithUser =
        currentRoute.name === 'chat' && currentRoute.params.friendId === data.from_user_id;

      if (!isChattingWithUser) {
        const toastStore = useToastStore();
        toastStore.info(`New message from ${data.from_username || 'Friend'}`);
      }
    });

    this.socket.on('chat:typing', (data: any) => {
      window.dispatchEvent(new CustomEvent('chat:typing', { detail: data }));
    });

    this.socket.on('chat:stop-typing', (data: any) => {
      window.dispatchEvent(new CustomEvent('chat:stop-typing', { detail: data }));
    });

    // Transaction events
    this.socket.on('transaction:success', (data: any) => {
      console.log('📡 Transaction success:', data);
      const userStore = useUserStore();
      const notificationStore = useNotificationStore();
      const toastStore = useToastStore();

      // Update balance
      if (data.newBalance !== undefined) {
        userStore.updateBalance('CHF', data.newBalance);
      }

      // Add notification
      notificationStore.addNotification({
        title: 'Achat confirmé',
        message: `Vous avez acheté ${data.game.game_name} pour ${data.game.purchase_price} CHF.`,
        type: 'success',
        actionUrl: '/library',
      });

      // Show toast
      toastStore.success(`Achat réussi : ${data.game.game_name}`);
    });

    this.socket.on('transaction:seller_notification', (data: any) => {
      console.log('📡 Seller notification:', data);
      const userStore = useUserStore();
      const notificationStore = useNotificationStore();
      const toastStore = useToastStore();

      // Fetch profile to get updated balance
      userStore.fetchProfile();

      // Add notification
      notificationStore.addNotification({
        title: 'Vente réalisée !',
        message: data.message,
        type: 'success',
        actionUrl: '/profile',
      });

      // Show toast
      toastStore.success(data.message);
    });

    console.log('📡 WebSocket event listeners registered');
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      // Keep the instance but mark as disconnected/cleanup if needed
      // NativeSocketService handles cleanup in disconnect()
    }
  }

  emit(event: string, data: any) {
    if (this.socket && this.isConnected) {
      console.log(`📤 Emitting: ${event}`, data);
      this.socket.emit(event, data);
    } else {
      console.warn('[Socket] Cannot emit, not connected');
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string) {
    if (this.socket) {
      // Remove listener not fully implemented in NativeSocketService using EventEmitter
      // But EventEmitter has .off (alias for removeListener)
      this.socket.off(event, () => {}); // removeAllListeners(event) might be better if no callback passed
      // NativeSocketService extends EventEmitter, so it has off or removeListener.
      // But we need the reference to the callback to remove specific one.
      // For now, simple wrapper.
      this.socket.removeAllListeners(event);
    }
  }

  // Specific methods for common actions
  sendLobbyInvite(friendId: string, lobbyId: string) {
    this.emit('lobby:invite', { friendId, lobbyId });
  }

  updateStatus(status: 'online' | 'offline' | 'in-game', lobbyId?: string) {
    this.emit('user:status-update', { status, lobbyId });
  }

  sendChatMessage(toUserId: string, content: string) {
    this.emit('chat:send-message', { toUserId, content });
  }

  sendTyping(toUserId: string) {
    this.emit('chat:typing', { toUserId });
  }

  sendStopTyping(toUserId: string) {
    this.emit('chat:stop-typing', { toUserId });
  }
}

// Singleton instance
export const socketService = new SocketService();
