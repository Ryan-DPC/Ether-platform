import { io, Socket } from 'socket.io-client'
import { useFriendsStore } from '../stores/friendsStore'
import { useLobbyStore } from '../stores/lobbyStore'
import { useToastStore } from '../stores/toastStore'
import { useUserStore } from '../stores/userStore'
import { useNotificationStore } from '../stores/notificationStore'
import router from '../router'

// Get WebSocket URL based on environment
// Get WebSocket URL based on environment
const getSocketUrl = () => {
    // For local development with Elysia + separate Socket.IO port
    return 'http://localhost:3001';

    /* Original logic commented out for migration
    let url = import.meta.env.VITE_WEBSOCKET_URL;
    const isTauri = !!(window as any).__TAURI__;
    if (url && isTauri && url.includes('ether_server')) { return null; }
    if (url) return url;
    if (import.meta.env.PROD && isTauri) {
        return 'https://server-1-z9ok.onrender.com';
    }
    return 'https://server-1-z9ok.onrender.com'
    */
}

class SocketService {
    private socket: Socket | null = null
    public isConnected = false

    connect(token: string) {
        // If already connected, just mark as connected
        if (this.socket?.connected) {
            this.isConnected = true;
            console.log('✅ Already connected to WebSocket');
            return;
        }

        // Initialize socket connection to central WebSocket server
        const socketUrl = getSocketUrl();
        console.log('🔌 Connecting to socket:', socketUrl);
        console.log('🔌 Token:', token.substring(0, 10) + '...');
        this.socket = io(socketUrl, {
            auth: {
                token: token
            },
            extraHeaders: {
                Authorization: `Bearer ${token}`
            }
        });

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
        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error.message);
        });

        // Friend status updates
        this.socket.on('friend:status-changed', (data) => {
            console.log('📡 Friend status changed:', data);
            const friendsStore = useFriendsStore();
            friendsStore.updateFriendStatus(data.userId, data.status, data.lobbyId);
        });

        // Friend request notifications
        this.socket.on('friend:request-sent', (data) => {
            console.log('📡 Friend request received:', data);
            const friendsStore = useFriendsStore();
            friendsStore.fetchFriendRequests();

            const toastStore = useToastStore();
            toastStore.info('New friend request received');
        });

        this.socket.on('friend:request-accepted-notification', (data) => {
            console.log('📡 Friend request accepted:', data);
            const friendsStore = useFriendsStore();
            friendsStore.fetchFriends();

            const toastStore = useToastStore();
            toastStore.success('Friend request accepted');
        });

        // Lobby events
        this.socket.on('lobby:invite-received', (data) => {
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
                    }
                }
            });
        });

        this.socket.on('lobby:player-joined', (data) => {
            console.log('📡 Player joined lobby:', data);
            const lobbyStore = useLobbyStore();
            lobbyStore.updateLobbyPlayers(data.players);
        });

        this.socket.on('lobby:player-left', (data) => {
            console.log('📡 Player left lobby:', data);
            const lobbyStore = useLobbyStore();
            lobbyStore.updateLobbyPlayers(data.players);
        });

        // Chat events
        this.socket.on('chat:message-received', (data) => {
            console.log('📡 Chat message received:', data);
            // Will be handled by Chat.vue component
            window.dispatchEvent(new CustomEvent('chat:new-message', { detail: data }));

            // Show toast if not on chat page with this user
            const currentRoute = router.currentRoute.value;
            const isChattingWithUser = currentRoute.name === 'chat' && currentRoute.params.friendId === data.from_user_id;

            if (!isChattingWithUser) {
                const toastStore = useToastStore();
                toastStore.info(`New message from ${data.from_username || 'Friend'}`);
            }
        });

        this.socket.on('chat:typing', (data) => {
            window.dispatchEvent(new CustomEvent('chat:typing', { detail: data }));
        });

        this.socket.on('chat:stop-typing', (data) => {
            window.dispatchEvent(new CustomEvent('chat:stop-typing', { detail: data }));
        });

        // Transaction events
        this.socket.on('transaction:success', (data) => {
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
                actionUrl: '/library'
            });

            // Show toast
            toastStore.success(`Achat réussi : ${data.game.game_name}`);
        });

        this.socket.on('transaction:seller_notification', (data) => {
            console.log('📡 Seller notification:', data);
            const userStore = useUserStore();
            const notificationStore = useNotificationStore();
            const toastStore = useToastStore();

            // Fetch profile to get updated balance since server only sends amount added
            // Or we can calculate it if we trust the current state
            // For now, let's fetch profile to be safe and accurate
            userStore.fetchProfile();

            // Add notification
            notificationStore.addNotification({
                title: 'Vente réalisée !',
                message: data.message,
                type: 'success',
                actionUrl: '/profile'
            });

            // Show toast
            toastStore.success(data.message);
        });

        console.log('📡 WebSocket event listeners registered');
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
        }
    }

    emit(event: string, data: any) {
        if (this.socket?.connected) {
            console.log(`📤 Emitting: ${event}`, data)
            this.socket.emit(event, data)
        } else {
            console.warn('[Socket] Cannot emit, not connected')
        }
    }

    on(event: string, callback: (data: any) => void) {
        if (this.socket) {
            this.socket.on(event, callback)
        }
    }

    off(event: string) {
        if (this.socket) {
            this.socket.off(event)
        }
    }

    // Specific methods for common actions
    sendLobbyInvite(friendId: string, lobbyId: string) {
        this.emit('lobby:invite', { friendId, lobbyId })
    }

    updateStatus(status: 'online' | 'offline' | 'in-game', lobbyId?: string) {
        this.emit('user:status-update', { status, lobbyId })
    }

    sendChatMessage(toUserId: string, content: string) {
        this.emit('chat:send-message', { toUserId, content })
    }

    sendTyping(toUserId: string) {
        this.emit('chat:typing', { toUserId })
    }

    sendStopTyping(toUserId: string) {
        this.emit('chat:stop-typing', { toUserId })
    }
}

// Singleton instance
export const socketService = new SocketService()
