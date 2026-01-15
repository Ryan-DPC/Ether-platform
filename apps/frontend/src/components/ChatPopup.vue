<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted, watch } from 'vue';
import axios from 'axios';
import { socketService } from '../services/socket';
import { getMessagesByFriendId, saveMessage } from '../services/db';
import { useUserStore } from '../stores/userStore';

const props = defineProps<{
  friend: any;
}>();

const emit = defineEmits(['close']);

const messages = ref<any[]>([]);
const newMessage = ref('');
const messagesContainer = ref<HTMLElement>();
const loading = ref(true);
const isTyping = ref(false);
const typingTimeout = ref<any>(null);
const emitTypingTimeout = ref<any>(null);

// Dragging State
const position = ref({ right: 320, bottom: 20 });
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const startPos = ref({ right: 0, bottom: 0 });

const startDrag = (event: MouseEvent) => {
  isDragging.value = true;
  dragStart.value = { x: event.clientX, y: event.clientY };
  startPos.value = { right: position.value.right, bottom: position.value.bottom };

  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
};

const onDrag = (event: MouseEvent) => {
  if (!isDragging.value) return;
  const deltaX = event.clientX - dragStart.value.x;
  const deltaY = event.clientY - dragStart.value.y;

  // Update position (subtract deltaX from right because moving right decreases right value)
  position.value.right = startPos.value.right - deltaX;
  position.value.bottom = startPos.value.bottom - deltaY;
};

const stopDrag = () => {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
};

// Handle incoming messages
const handleNewMessage = (event: CustomEvent) => {
  const data = event.detail;
  if (data.from_user_id === props.friend.id) {
    messages.value.push(data);
    isTyping.value = false;
    nextTick(() => scrollToBottom());
  }
};

const handleRemoteTyping = (event: CustomEvent) => {
  const data = event.detail;
  if (data.fromUserId === props.friend.id) {
    isTyping.value = true;
    if (typingTimeout.value) clearTimeout(typingTimeout.value);
    typingTimeout.value = setTimeout(() => {
      isTyping.value = false;
    }, 3000);
  }
};

const handleRemoteStopTyping = (event: CustomEvent) => {
  const data = event.detail;
  if (data.fromUserId === props.friend.id) {
    isTyping.value = false;
    if (typingTimeout.value) clearTimeout(typingTimeout.value);
  }
};

const onInput = () => {
  if (emitTypingTimeout.value) clearTimeout(emitTypingTimeout.value);
  socketService.sendTyping(props.friend.id);
  emitTypingTimeout.value = setTimeout(() => {
    socketService.sendStopTyping(props.friend.id);
  }, 2000);
};

const loadMessages = async () => {
  loading.value = true;
  const userStore = useUserStore();
  const myUserId = userStore.user?.id;

  if (!myUserId) {
    loading.value = false;
    return;
  }

  try {
    // 1. Load from Local DB first (Offline First)
    const localMessages = await getMessagesByFriendId(props.friend.id, myUserId);
    if (localMessages.length > 0) {
      messages.value = localMessages;
      nextTick(() => scrollToBottom());
    }

    // 2. Fetch from server to get new messages
    const response = await axios.get(`/chat/conversation/${props.friend.id}`);
    const remoteMessages = response.data.messages || [];

    // 3. Save remote messages to local DB and update UI
    for (const msg of remoteMessages) {
      await saveMessage({
        ...msg,
        to_user_id: msg.is_from_me ? props.friend.id : myUserId,
        from_user_id: msg.is_from_me ? myUserId : props.friend.id,
      });
    }

    // Final UI update with synced data
    messages.value = await getMessagesByFriendId(props.friend.id, myUserId);
    nextTick(() => scrollToBottom());
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

  // Optimistic update
  const userStore = useUserStore();
  const myUserId = userStore.user?.id;
  const tempMsg = {
    id: 'temp-' + Date.now(),
    content: messageContent,
    from_user_id: myUserId,
    to_user_id: props.friend.id,
    is_from_me: true,
    created_at: new Date().toISOString(),
  };

  messages.value.push(tempMsg);

  // Save to Local DB
  saveMessage(tempMsg).catch((err) => console.error('Failed to save sent message to DB:', err));

  nextTick(() => scrollToBottom());

  socketService.sendChatMessage(props.friend.id, messageContent);
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

onMounted(() => {
  loadMessages();
  window.addEventListener('chat:new-message', handleNewMessage as EventListener);
  window.addEventListener('chat:typing', handleRemoteTyping as EventListener);
  window.addEventListener('chat:stop-typing', handleRemoteStopTyping as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('chat:new-message', handleNewMessage as EventListener);
  window.removeEventListener('chat:typing', handleRemoteTyping as EventListener);
  window.removeEventListener('chat:stop-typing', handleRemoteStopTyping as EventListener);
});

watch(
  () => props.friend,
  () => {
    loadMessages();
  }
);
</script>

<template>
  <div class="chat-popup" :style="{ right: position.right + 'px', bottom: position.bottom + 'px' }">
    <div class="popup-header" @mousedown="startDrag">
      <div class="header-info">
        <img :src="friend.profile_pic || '/assets/images/default-game.svg'" class="avatar-small" />
        <div class="user-details">
          <span class="username">{{ friend.username }}</span>
          <span class="status" :class="friend.status">{{ friend.status }}</span>
        </div>
      </div>
      <button @click="$emit('close')" class="btn-close"><i class="fas fa-times"></i></button>
    </div>

    <div class="popup-body" ref="messagesContainer">
      <div v-if="loading" class="loading"><i class="fas fa-circle-notch fa-spin"></i></div>
      <div v-else-if="messages.length === 0" class="empty">No messages yet.</div>

      <div v-else class="messages-list">
        <div
          v-for="msg in messages"
          :key="msg.id"
          :class="['message', msg.is_from_me ? 'mine' : 'theirs']"
        >
          <div class="bubble">{{ msg.content }}</div>
        </div>
      </div>

      <div v-if="isTyping" class="typing">Typing...</div>
    </div>

    <div class="popup-footer">
      <form @submit.prevent="sendMessage">
        <input
          v-model="newMessage"
          @input="onInput"
          placeholder="Type a message..."
          class="chat-input"
        />
        <button type="submit" class="btn-send"><i class="fas fa-paper-plane"></i></button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.chat-popup {
  position: fixed; /* Changed to fixed for global persistence */
  /* right and bottom are now dynamic via inline styles */
  width: 320px;
  height: 400px;
  background: #1e1928;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  overflow: hidden;
}

.popup-header {
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  justify-content: space-between;
  align-items: center;
  cursor: grab;
}
.popup-header:active {
  cursor: grabbing;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar-small {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}
.user-details {
  display: flex;
  flex-direction: column;
}
.username {
  font-weight: 600;
  font-size: 0.9rem;
  color: white;
}
.status {
  font-size: 0.7rem;
  color: #888;
  text-transform: capitalize;
}
.status.online {
  color: #00ff00;
}
.status.in-game {
  color: #ff7eb3;
}

.btn-close {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  transition: color 0.2s;
}
.btn-close:hover {
  color: white;
}

.popup-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
}

.popup-body::-webkit-scrollbar {
  width: 4px;
}
.popup-body::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 2px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message {
  display: flex;
  max-width: 85%;
}
.message.mine {
  align-self: flex-end;
}
.message.theirs {
  align-self: flex-start;
}

.bubble {
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 0.9rem;
  word-wrap: break-word;
}

.message.mine .bubble {
  background: #7afcff;
  color: #120c18;
  border-bottom-right-radius: 2px;
}

.message.theirs .bubble {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-bottom-left-radius: 2px;
}

.typing {
  font-size: 0.7rem;
  color: #888;
  font-style: italic;
  margin-left: 10px;
}
.loading,
.empty {
  text-align: center;
  color: #666;
  margin-top: 20px;
  font-size: 0.8rem;
}

.popup-footer {
  padding: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.02);
}

.popup-footer form {
  display: flex;
  gap: 8px;
}

.chat-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 8px 12px;
  color: white;
  font-size: 0.9rem;
  outline: none;
}
.chat-input:focus {
  border-color: #7afcff;
}

.btn-send {
  background: #7afcff;
  color: #120c18;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
}
.btn-send:hover {
  transform: scale(1.1);
}
</style>
