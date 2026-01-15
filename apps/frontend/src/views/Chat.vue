<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import axios from 'axios';
import { socketService } from '../services/socket';
import { useUserStore } from '../stores/userStore';
import { getMessagesByFriendId, saveMessage } from '../services/db';

const route = useRoute();
const friendId = route.params.friendId as string;

const user = ref<any>(null);
const messages = ref<any[]>([]);
const newMessage = ref('');
const messagesContainer = ref<HTMLElement>();
const loading = ref(true);

const isTyping = ref(false);
const typingTimeout = ref<any>(null);
const emitTypingTimeout = ref<any>(null);

// Handle incoming messages from WebSocket
const handleNewMessage = (event: CustomEvent) => {
  const data = event.detail;
  if (data.from_user_id === friendId) {
    messages.value.push(data);
    isTyping.value = false; // Stop typing indicator when message received
    nextTick(() => scrollToBottom());
  }
};

const handleRemoteTyping = (event: CustomEvent) => {
  const data = event.detail;
  if (data.fromUserId === friendId) {
    isTyping.value = true;
    // Auto-hide after 3 seconds if no stop-typing received
    if (typingTimeout.value) clearTimeout(typingTimeout.value);
    typingTimeout.value = setTimeout(() => {
      isTyping.value = false;
    }, 3000);
  }
};

const handleRemoteStopTyping = (event: CustomEvent) => {
  const data = event.detail;
  if (data.fromUserId === friendId) {
    isTyping.value = false;
    if (typingTimeout.value) clearTimeout(typingTimeout.value);
  }
};

const onInput = () => {
  if (emitTypingTimeout.value) clearTimeout(emitTypingTimeout.value);

  socketService.sendTyping(friendId);

  emitTypingTimeout.value = setTimeout(() => {
    socketService.sendStopTyping(friendId);
  }, 2000);
};

onMounted(async () => {
  await loadFriend();
  await loadMessages();
  scrollToBottom();

  // Listen for real-time messages
  window.addEventListener('chat:new-message', handleNewMessage as EventListener);
  window.addEventListener('chat:typing', handleRemoteTyping as EventListener);
  window.addEventListener('chat:stop-typing', handleRemoteStopTyping as EventListener);
});

onUnmounted(() => {
  // Cleanup event listener
  window.removeEventListener('chat:new-message', handleNewMessage as EventListener);
  window.removeEventListener('chat:typing', handleRemoteTyping as EventListener);
  window.removeEventListener('chat:stop-typing', handleRemoteStopTyping as EventListener);
});

const loadFriend = async () => {
  try {
    const response = await axios.get(`/users/${friendId}`);
    user.value = response.data.user;
  } catch (error) {
    console.error('Failed to load friend:', error);
  }
};

const loadMessages = async () => {
  const userStore = useUserStore();
  const myUserId = userStore.user?.id;

  if (!myUserId) {
    loading.value = false;
    return;
  }

  try {
    // 1. Offline First: check local DB
    try {
      const localMessages = await getMessagesByFriendId(friendId, myUserId);
      if (localMessages.length > 0) {
        messages.value = localMessages;
        nextTick(scrollToBottom);
      }
    } catch (err) {
      console.warn('DB Load failed:', err);
    }

    const response = await axios.get(`/chat/conversation/${friendId}`);
    const remoteMessages = Array.isArray(response.data)
      ? response.data
      : response.data.messages || [];

    // 2. Persist to local DB
    for (const msg of remoteMessages) {
      saveMessage({
        ...msg,
        to_user_id: msg.is_from_me ? friendId : myUserId,
        from_user_id: msg.is_from_me ? myUserId : friendId,
      }).catch((err) => console.error('Failed to sync to local DB:', err));
    }

    // 3. Final refresh
    if (remoteMessages.length > 0) {
      try {
        messages.value = await getMessagesByFriendId(friendId, myUserId);
      } catch (e) {
        messages.value = remoteMessages;
      }
    } else {
      try {
        messages.value = await getMessagesByFriendId(friendId, myUserId);
      } catch (e) {
        /* ignore */
      }
    }
    nextTick(scrollToBottom);
  } catch (error) {
    console.error('Failed to load messages:', error);
  } finally {
    loading.value = false;
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim()) return;

  const messageContent = newMessage.value.trim();
  newMessage.value = '';

  // Add optimistic message
  const userStore = useUserStore();
  const myUserId = userStore.user?.id;
  const tempMsg = {
    id: 'temp-' + Date.now(),
    content: messageContent,
    from_user_id: myUserId,
    to_user_id: friendId,
    is_from_me: true,
    created_at: new Date().toISOString(),
  };

  messages.value.push(tempMsg);

  // Save to local DB
  saveMessage(tempMsg).catch((err) => console.error('Failed to save sent message to DB:', err));

  await nextTick();
  scrollToBottom();

  // Send via WebSocket for real-time delivery
  socketService.sendChatMessage(friendId, messageContent);

  // Also save to database via HTTP
  try {
    await axios.post(`/chat/send`, {
      toUserId: friendId,
      content: messageContent,
    });
  } catch (error) {
    console.error('Failed to save message to DB:', error);
  }
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const formatTime = (date: string) => {
  return new Date(date).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>

<template>
  <div class="chat-page">
    <!-- Chat Header -->
    <header class="chat-header">
      <RouterLink to="/home" class="back-button"> ← </RouterLink>
      <div v-if="user" class="friend-info">
        <img
          :src="user.profile_pic || '/assets/images/default-game.svg'"
          :alt="user.username"
          class="friend-avatar"
        />
        <div class="friend-details">
          <h2>{{ user.username }}</h2>
          <span class="status online">● En ligne</span>
        </div>
      </div>
      <div v-else class="friend-info">
        <div class="friend-details">
          <h2>Chargement...</h2>
        </div>
      </div>
    </header>

    <!-- Messages Container -->
    <div ref="messagesContainer" class="messages-container">
      <div v-if="loading" class="loading">Chargement des messages...</div>
      <div v-else-if="messages.length === 0" class="empty-state">
        Aucun message. Commencez la conversation !
      </div>
      <div v-else class="messages-list">
        <div
          v-for="message in messages"
          :key="message.id"
          :class="['message', message.is_from_me ? 'message-mine' : 'message-theirs']"
        >
          <div class="message-content">
            <p>{{ message.content }}</p>
            <span class="message-time">{{ formatTime(message.created_at) }}</span>
          </div>
        </div>

        <!-- Typing Indicator -->
        <div v-if="isTyping" class="typing-indicator">
          <span>{{ user?.username }} est en train d'écrire...</span>
        </div>
      </div>
    </div>

    <!-- Message Input -->
    <div class="message-input-container">
      <form @submit.prevent="sendMessage" class="message-form">
        <input
          v-model="newMessage"
          @input="onInput"
          type="text"
          placeholder="Écrivez votre message..."
          class="message-input"
          maxlength="500"
        />
        <button type="submit" class="send-button" :disabled="!newMessage.trim()">Envoyer</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: transparent;
  color: #fff;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: #2a2a2a;
  border-bottom: 1px solid #3a3a3a;
  flex-shrink: 0;
}

.back-button {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #333;
  border-radius: 8px;
  color: #fff;
  text-decoration: none;
  font-size: 20px;
  transition: background 0.2s;
}

.back-button:hover {
  background: #444;
}

.friend-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.friend-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.friend-details h2 {
  margin: 0;
  font-size: 18px;
}

.status {
  font-size: 13px;
  color: #aaa;
}

.status.online {
  color: #00ff00;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #1a1a1a;
}

.loading,
.empty-state {
  text-align: center;
  color: #888;
  padding: 40px 20px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  display: flex;
  max-width: 70%;
}

.message-mine {
  align-self: flex-end;
}

.message-theirs {
  align-self: flex-start;
}

.message-content {
  padding: 12px 16px;
  border-radius: 12px;
  position: relative;
}

.message-mine .message-content {
  background: #4a9eff;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message-theirs .message-content {
  background: #2a2a2a;
  color: #fff;
  border-bottom-left-radius: 4px;
}

.message-content p {
  margin: 0 0 4px 0;
  word-wrap: break-word;
}

.message-time {
  font-size: 11px;
  opacity: 0.7;
}

.typing-indicator {
  padding: 8px 16px;
  font-size: 12px;
  color: #888;
  font-style: italic;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.message-input-container {
  padding: 16px 24px;
  background: #2a2a2a;
  border-top: 1px solid #3a3a3a;
  flex-shrink: 0;
}

.message-form {
  display: flex;
  gap: 12px;
}

.message-input {
  flex: 1;
  padding: 12px 16px;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.message-input:focus {
  border-color: #4a9eff;
}

.message-input::placeholder {
  color: #666;
}

.send-button {
  padding: 12px 24px;
  background: #4a9eff;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.send-button:hover:not(:disabled) {
  background: #3a8eef;
}

.send-button:disabled {
  background: #333;
  cursor: not-allowed;
  opacity: 0.5;
}

/* Scrollbar styling */
.messages-container::-webkit-scrollbar {
  width: 8px;
}

.messages-container::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
