<script setup lang="ts">
import { ref, onMounted, computed, nextTick, onUnmounted } from 'vue';
import axios from 'axios';
import { useFriendsStore } from '../stores/friendsStore';
import { useToastStore } from '../stores/toastStore';
import { useGroupStore } from '../stores/groupStore';
import { socketService } from '../services/socket';
import { useUserStore } from '../stores/userStore';
import { getMessagesByFriendId, saveMessage, deleteMessagesByFriendId } from '../services/db';
import UserAutocomplete from '../components/UserAutocomplete.vue';

const friendsStore = useFriendsStore();
const toastStore = useToastStore();
const groupStore = useGroupStore();
const userStore = useUserStore();
const myUserId = computed(() => userStore.user?.id);
const activeTab = ref('friends'); // 'friends', 'requests', 'groups', 'add_friend'
const searchQuery = ref('');
const addFriendQuery = ref('');
const isSearching = ref(false);
const showCreateGroupModal = ref(false);
const newGroupName = ref('');
const newGroupDescription = ref('');
const groupMessage = ref('');
const showGroupSidebar = ref(false);

// Private Chat State
const activeFriend = ref<any>(null);
const privateMessages = ref<any[]>([]);
const privateMessageInput = ref('');
const privateChatLoading = ref(false);
const privateMessagesContainer = ref<HTMLElement>();

const filteredGroups = computed(() => {
  if (!searchQuery.value) return groupStore.myGroups;
  return groupStore.myGroups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

onMounted(async () => {
  await friendsStore.fetchFriends();
  await friendsStore.fetchFriendRequests();
  await groupStore.fetchMyGroups();
  groupStore.setupWebSocketListeners();

  window.addEventListener('chat:new-message', handlePrivateMessage as EventListener);
  // Listen for friend status changes
  socketService.on('friend:status-changed', handleFriendStatusChange);
});

onUnmounted(() => {
  window.removeEventListener('chat:new-message', handlePrivateMessage as EventListener);
  socketService.off('friend:status-changed');
});

const handleFriendStatusChange = (data: any) => {
  friendsStore.updateFriendStatus(data.userId, data.status, data.lobbyId);
};

const handleAccept = async (requestId: string) => {
  try {
    await friendsStore.acceptFriendRequest(requestId);
    toastStore.success('Friend request accepted');
  } catch (e) {
    toastStore.error('Error accepting request');
  }
};

const handleReject = async (requestId: string) => {
  try {
    await friendsStore.rejectFriendRequest(requestId);
    toastStore.info('Friend request rejected');
  } catch (e) {
    toastStore.error('Error rejecting request');
  }
};

const handleAddFriend = async () => {
  if (!addFriendQuery.value.trim()) return;

  isSearching.value = true;
  try {
    await friendsStore.sendFriendRequest(addFriendQuery.value);
    toastStore.success(`Friend request sent to ${addFriendQuery.value}`);
    addFriendQuery.value = '';
  } catch (e: any) {
    toastStore.error(e.message || 'Failed to send friend request');
  } finally {
    isSearching.value = false;
  }
};

const handleCreateGroup = async () => {
  if (!newGroupName.value.trim()) {
    toastStore.error('Group name is required');
    return;
  }
  try {
    await groupStore.createGroup(newGroupName.value, newGroupDescription.value);
    toastStore.success('Group created successfully');
    newGroupName.value = '';
    newGroupDescription.value = '';
    showCreateGroupModal.value = false;
  } catch (e: any) {
    toastStore.error(e.message || 'Failed to create group');
  }
};

const selectGroup = (groupId: string) => {
  groupStore.selectGroup(groupId);
};

const sendGroupMessage = () => {
  if (!groupMessage.value.trim()) return;
  groupStore.sendMessage(groupMessage.value);
  groupMessage.value = '';
};

const handleAddFriendFromGroup = async (_userId: string, username: string) => {
  try {
    await friendsStore.sendFriendRequest(username);
    toastStore.success(`Friend request sent to ${username}`);
  } catch (e: any) {
    toastStore.error(e.message || 'Failed to send request');
  }
};

const handleRemoveFriend = async (friendId: string, username: string) => {
  if (!confirm(`Are you sure you want to remove ${username} from friends?`)) return;
  try {
    await friendsStore.removeFriend(friendId);
    toastStore.success('Friend removed');
  } catch (e: any) {
    toastStore.error(e.message || 'Failed to remove friend');
  }
};

const openChat = async (friendId: string) => {
  activeFriend.value = friendsStore.friends.find((f: any) => f.id === friendId);
  if (!activeFriend.value) return;

  activeTab.value = 'friends';
  privateChatLoading.value = true;
  await loadPrivateMessages(friendId);
  privateChatLoading.value = false;
  nextTick(() => scrollToPrivateBottom());
};

const handleClearChat = async () => {
  if (!activeFriend.value) return;
  const friendId = activeFriend.value.id;
  if (
    !confirm(
      `Effacer toute la conversation avec ${activeFriend.value.username} ? Cette action est irréversible.`
    )
  )
    return;

  try {
    // 1. Delete on Backend
    await axios.delete(`/chat/conversation/${friendId}`);

    // 2. Delete on Local DB
    const userStore = useUserStore();
    const myUserId = userStore.user?.id;
    if (myUserId) {
      await deleteMessagesByFriendId(friendId, myUserId);
    }

    // 3. Update UI
    privateMessages.value = [];
    toastStore.success('Conversation effacée');
  } catch (error) {
    console.error('Failed to clear chat:', error);
    toastStore.error('Erreur lors de la suppression');
  }
};

const loadPrivateMessages = async (friendId: string) => {
  const userStore = useUserStore();
  const myUserId = userStore.user?.id;

  if (!myUserId) return;

  try {
    // 1. Offline First: check local DB
    try {
      const localMessages = await getMessagesByFriendId(friendId, myUserId);
      if (localMessages.length > 0) {
        privateMessages.value = localMessages;
        nextTick(scrollToPrivateBottom);
      }
    } catch (dbErr) {
      console.warn('DB Load failed:', dbErr);
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

    // 3. Final refresh & Sync
    if (remoteMessages.length > 0) {
      try {
        privateMessages.value = await getMessagesByFriendId(friendId, myUserId);
      } catch (e) {
        privateMessages.value = remoteMessages;
      }
    } else if (response.status === 200) {
      // If server explicitly returns 0 messages, clear local cache for this friend
      // as it means the conversation was likely deleted or is truly empty
      await deleteMessagesByFriendId(friendId, myUserId);
      privateMessages.value = [];
    }
    nextTick(scrollToPrivateBottom);
  } catch (e: any) {
    console.error('Failed to load messages', e);
    toastStore.error('Failed to load conversation');
  }
};

const sendPrivateMessage = async () => {
  if (!privateMessageInput.value.trim() || !activeFriend.value) return;
  const content = privateMessageInput.value.trim();
  privateMessageInput.value = '';

  // Optimistic UI
  const userStore = useUserStore();
  const myUserId = userStore.user?.id;
  const tempMsg = {
    id: 'temp-' + Date.now(),
    content,
    from_user_id: myUserId,
    to_user_id: activeFriend.value.id,
    is_from_me: true,
    created_at: new Date().toISOString(),
    user: { username: 'Me' },
  };

  privateMessages.value.push(tempMsg);

  await nextTick();
  scrollToPrivateBottom();

  // Save to local DB for offline support
  saveMessage(tempMsg).catch((err) => console.error('Failed to save sent message local:', err));

  // Send via WebSocket ONLY (backend will persist it)
  socketService.sendChatMessage(activeFriend.value.id, content);
};

const scrollToPrivateBottom = () => {
  if (privateMessagesContainer.value) {
    privateMessagesContainer.value.scrollTop = privateMessagesContainer.value.scrollHeight;
  }
};

const handlePrivateMessage = (event: CustomEvent) => {
  const data = event.detail;
  if (activeFriend.value && data.from_user_id === activeFriend.value.id) {
    privateMessages.value.push(data);
    nextTick(scrollToPrivateBottom);
  }
};
</script>

<template>
  <div class="social-container">
    <!-- Background Glows -->
    <div class="bg-glow pink-glow"></div>
    <div class="bg-glow cyan-glow"></div>

    <div class="social-layout">
      <!-- Left Panel: Navigation & Lists -->
      <div class="glass-panel sidebar">
        <div class="panel-header">
          <h2>Social Hub</h2>
          <div class="user-status-toggle">
            <div class="status-dot online"></div>
            <span>Online</span>
            <i class="fas fa-chevron-down"></i>
          </div>
        </div>

        <div class="nav-tabs">
          <button :class="{ active: activeTab === 'friends' }" @click="activeTab = 'friends'">
            <i class="fas fa-user-friends"></i> Friends
            <span class="badge">{{ friendsStore.friends.length }}</span>
          </button>
          <button :class="{ active: activeTab === 'requests' }" @click="activeTab = 'requests'">
            <i class="fas fa-user-plus"></i> Requests
            <span v-if="friendsStore.friendRequests.length > 0" class="badge alert">{{
              friendsStore.friendRequests.length
            }}</span>
          </button>
          <button :class="{ active: activeTab === 'groups' }" @click="activeTab = 'groups'">
            <i class="fas fa-users"></i> Groups
          </button>
          <button :class="{ active: activeTab === 'add_friend' }" @click="activeTab = 'add_friend'">
            <i class="fas fa-search-plus"></i> Add
          </button>
        </div>

        <div class="search-box" v-if="activeTab !== 'add_friend'">
          <i class="fas fa-search"></i>
          <input v-model="searchQuery" placeholder="Filter..." />
        </div>

        <div class="list-content">
          <!-- Friends List -->
          <div v-if="activeTab === 'friends'" class="friends-list">
            <div v-if="friendsStore.friends.length === 0" class="empty-state">
              <i class="fas fa-user-friends"></i>
              <p>No friends yet</p>
              <p class="hint-text">Add friends to see them here</p>
            </div>
            <div v-for="friend in friendsStore.friends" :key="friend.id" class="list-item">
              <div class="avatar-wrapper">
                <img :src="friend.profile_pic || '/default-avatar.svg'" alt="Avatar" />
                <div class="status-indicator" :class="friend.status"></div>
              </div>
              <div class="item-info">
                <div class="item-name">{{ friend.username }}</div>
                <div class="item-status">{{ friend.status }}</div>
              </div>
              <div class="item-actions">
                <button class="btn-icon" title="Message" @click.stop="openChat(friend.id)">
                  <i class="fas fa-comment-alt"></i>
                </button>
                <button class="btn-icon" title="Invite"><i class="fas fa-gamepad"></i></button>
                <button
                  class="btn-icon danger"
                  title="Remove Friend"
                  @click.stop="handleRemoveFriend(friend.id, friend.username)"
                >
                  <i class="fas fa-user-minus"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Requests List -->
          <div v-if="activeTab === 'requests'" class="requests-list">
            <div v-if="friendsStore.friendRequests.length === 0" class="empty-state">
              No pending requests
            </div>
            <div
              v-for="req in friendsStore.friendRequests"
              :key="req.request_id"
              class="list-item request-item"
            >
              <img :src="req.profile_pic || 'https://via.placeholder.com/40'" class="avatar-sm" />
              <div class="item-info">
                <div class="item-name">{{ req.username }}</div>
                <div class="item-status">Wants to be friends</div>
              </div>
              <div class="req-actions">
                <button @click="handleAccept(req.request_id)" class="btn-accept">
                  <i class="fas fa-check"></i>
                </button>
                <button @click="handleReject(req.request_id)" class="btn-reject">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Groups List - Modern Design -->
          <div v-if="activeTab === 'groups'" class="groups-list-modern">
            <div class="groups-top-actions">
              <button @click="showCreateGroupModal = true" class="btn-primary-modern">
                <i class="fas fa-plus-circle"></i>
                <span>New Group</span>
              </button>
            </div>

            <div v-if="filteredGroups.length === 0" class="empty-state-modern">
              <div class="empty-icon">
                <i class="fas fa-users"></i>
              </div>
              <h4>No groups yet</h4>
              <p>Create your first group to collaborate with friends</p>
            </div>

            <div v-else class="groups-grid">
              <div
                v-for="group in filteredGroups"
                :key="group.id"
                class="group-card-modern"
                :class="{ active: groupStore.activeGroupId === group.id }"
                @click="selectGroup(group.id)"
              >
                <div class="group-card-header">
                  <div class="group-icon">
                    <img v-if="group.icon_url" :src="group.icon_url" alt="" />
                    <i v-else class="fas fa-users"></i>
                  </div>
                  <div class="group-card-badge" v-if="groupStore.activeGroupId === group.id">
                    <i class="fas fa-check-circle"></i>
                  </div>
                </div>
                <div class="group-card-body">
                  <h4>{{ group.name }}</h4>
                  <div class="group-card-meta">
                    <span><i class="fas fa-user"></i> {{ group.members.length }}</span>
                    <span class="group-status">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Add Friend Tab -->
          <div v-if="activeTab === 'add_friend'" class="add-friend-section">
            <div class="search-box-large">
              <UserAutocomplete
                v-model="addFriendQuery"
                placeholder="Enter username#1234"
                @select="handleAddFriend"
                class="social-autocomplete"
              >
                <template #prefix-icon>
                  <!-- Intentionally left blank or can add icon if needed inside component via slot or keep outside -->
                </template>
              </UserAutocomplete>
              <button @click="handleAddFriend" :disabled="isSearching" class="btn-neon-sm">
                <i class="fas fa-paper-plane" v-if="!isSearching"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
              </button>
            </div>
            <p class="hint-text">
              Enter the full username with discriminator (e.g., User#1234) to send a friend request.
            </p>
          </div>
        </div>
      </div>

      <!-- Right Panel: Chat / Activity -->
      <div class="glass-panel main-panel">
        <div class="main-content-wrapper">
          <!-- Private Chat (Friends) -->
          <div v-if="activeTab === 'friends' && activeFriend" class="group-chat-panel">
            <div class="chat-header-modern">
              <div class="chat-header-left">
                <img
                  :src="activeFriend.profile_pic || '/default-avatar.svg'"
                  class="header-avatar"
                />
                <div class="header-info">
                  <h3>{{ activeFriend.username }}</h3>
                  <div class="header-status">
                    <div class="status-dot" :class="activeFriend.status"></div>
                    <span>{{ activeFriend.status }}</span>
                  </div>
                </div>
              </div>
              <div class="chat-header-actions">
                <button
                  class="btn-action-ghost"
                  @click="handleClearChat"
                  title="Effacer l'historique"
                >
                  <i class="fas fa-trash-alt"></i>
                </button>
                <button class="btn-action-ghost" @click="activeFriend = null" title="Fermer">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div class="chat-messages" ref="privateMessagesContainer">
              <div v-if="privateChatLoading" class="chat-loading">
                <i class="fas fa-circle-notch fa-spin"></i>
                <p>Loading conversation...</p>
              </div>

              <div
                v-for="(msg, index) in privateMessages"
                :key="msg.id"
                class="message-row"
                :class="{
                  mine: msg.is_from_me,
                  'group-start':
                    index === 0 || privateMessages[index - 1].is_from_me !== msg.is_from_me,
                }"
              >
                <div v-if="!msg.is_from_me" class="avatar-col">
                  <img
                    v-if="
                      index === 0 ||
                      privateMessages[index - 1].is_from_me ||
                      privateMessages[index - 1].from_user_id !== msg.from_user_id
                    "
                    :src="activeFriend.profile_pic || '/default-avatar.svg'"
                    class="msg-avatar"
                  />
                </div>

                <div class="msg-content">
                  <div class="msg-bubble" :class="{ 'my-bubble': msg.is_from_me }">
                    <div class="msg-text">{{ msg.content }}</div>
                    <span class="msg-time-inline">{{
                      new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="chat-input-area">
              <div class="input-glass-wrapper">
                <input
                  v-model="privateMessageInput"
                  @keyup.enter="sendPrivateMessage"
                  placeholder="Type a message..."
                  maxlength="500"
                />
                <div class="input-footer">
                  <span v-if="privateMessageInput.length > 400" class="char-counter">
                    {{ 500 - privateMessageInput.length }}
                  </span>
                  <button
                    @click="sendPrivateMessage"
                    class="btn-send-neon"
                    :disabled="!privateMessageInput.trim() || privateMessageInput.length > 500"
                  >
                    <i class="fas fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Group Chat -->
          <div v-if="activeTab === 'groups' && groupStore.activeGroup" class="group-chat-panel">
            <div class="chat-header-modern">
              <div class="chat-header-left">
                <div class="group-icon-header">
                  <i class="fas fa-users"></i>
                </div>
                <div class="header-info">
                  <h3>{{ groupStore.activeGroup?.name }}</h3>
                  <span class="header-subtitle"
                    >{{ groupStore.activeGroup?.members?.length }} members</span
                  >
                </div>
              </div>
              <div class="chat-header-actions">
                <button
                  class="btn-action-ghost"
                  @click="showGroupSidebar = !showGroupSidebar"
                  title="Members"
                >
                  <i class="fas fa-user-friends"></i>
                </button>
              </div>
            </div>
            <div class="chat-messages" ref="groupMessagesContainer">
              <div
                v-for="(msg, index) in groupStore.activeMessages"
                :key="msg.id"
                class="message-row"
                :class="{
                  mine: msg.user?.id === myUserId,
                  'group-start':
                    index === 0 ||
                    !groupStore.activeMessages[index - 1]?.user ||
                    groupStore.activeMessages[index - 1].user?.id !== msg.user?.id,
                }"
              >
                <div v-if="msg.user && msg.user.id !== myUserId" class="avatar-col">
                  <img
                    v-if="
                      index === 0 ||
                      !groupStore.activeMessages[index - 1]?.user ||
                      groupStore.activeMessages[index - 1].user?.id !== msg.user.id
                    "
                    :src="msg.user.profile_pic || '/default-avatar.svg'"
                    class="msg-avatar"
                  />
                </div>

                <div class="msg-content">
                  <div
                    class="msg-header"
                    v-if="
                      msg.user &&
                      msg.user.id !== myUserId &&
                      (index === 0 ||
                        !groupStore.activeMessages[index - 1]?.user ||
                        groupStore.activeMessages[index - 1].user?.id !== msg.user.id)
                    "
                  >
                    <span class="msg-username">{{ msg.user.username }}</span>
                  </div>
                  <div class="msg-bubble" :class="{ 'my-bubble': msg.user?.id === myUserId }">
                    <div class="msg-text">{{ msg.content }}</div>
                    <span class="msg-time-inline">{{
                      new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="chat-input-area">
              <div class="input-glass-wrapper">
                <input
                  v-model="groupMessage"
                  @keyup.enter="sendGroupMessage"
                  placeholder="Type a message to group..."
                  maxlength="500"
                />
                <div class="input-footer">
                  <button
                    @click="sendGroupMessage"
                    class="btn-send-neon"
                    :disabled="!groupMessage.trim()"
                  >
                    <i class="fas fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="chat-input-area">
              <div class="input-glass-wrapper">
                <input
                  v-model="groupMessage"
                  @keyup.enter="sendGroupMessage"
                  placeholder="Type a message to group..."
                  maxlength="500"
                />
                <div class="input-footer">
                  <button
                    @click="sendGroupMessage"
                    class="btn-send-neon"
                    :disabled="!groupMessage.trim()"
                  >
                    <i class="fas fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State - Only show when NO chat is active -->
          <div
            v-if="
              !(
                (activeTab === 'friends' && activeFriend) ||
                (activeTab === 'groups' && groupStore.activeGroup)
              )
            "
            class="empty-chat-state"
          >
            <div class="empty-state-card">
              <div class="icon-glow">
                <i class="fas fa-comments"></i>
              </div>
              <h2>{{ activeTab === 'groups' ? 'Explore Groups' : 'Stay Connected' }}</h2>
              <p>
                {{
                  activeTab === 'groups'
                    ? 'Join a circle of warriors. Discussion is the first step to strategy.'
                    : 'Select a friend to begin your journey. Every great quest starts with a "Hello".'
                }}
              </p>
            </div>
          </div>
        </div>

        <!-- Group Sidebar Panel -->
        <transition name="slide-left">
          <div v-if="showGroupSidebar && groupStore.activeGroup" class="group-sidebar-panel">
            <div class="sidebar-header">
              <h3>Members</h3>
              <button @click="showGroupSidebar = false" class="btn-icon-sm">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="sidebar-content">
              <div
                v-for="member in groupStore.activeGroup.members"
                :key="member.id"
                class="member-item"
              >
                <div class="member-avatar">
                  <div class="status-dot" :class="{ online: member.is_online }"></div>
                </div>
                <div class="member-info">
                  <div class="member-name">{{ member.username }}</div>
                </div>
                <button
                  @click="handleAddFriendFromGroup(member.id, member.username)"
                  class="btn-add-friend-mini"
                >
                  <i class="fas fa-user-plus"></i>
                </button>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>

  <!-- Create Group Modal -->
  <teleport to="body">
    <transition name="fade">
      <div v-if="showCreateGroupModal" class="modal-overlay" @click="showCreateGroupModal = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Create New Group</h3>
            <button @click="showCreateGroupModal = false" class="btn-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Group Name</label>
              <input v-model="newGroupName" placeholder="Enter group name" class="form-input" />
            </div>
            <div class="form-group">
              <label>Description (optional)</label>
              <textarea
                v-model="newGroupDescription"
                placeholder="What's this group about?"
                class="form-textarea"
              ></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="showCreateGroupModal = false" class="btn-secondary">Cancel</button>
            <button @click="handleCreateGroup" class="btn-primary">Create Group</button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
/* Variables */
:root {
  --neon-pink: #ff7eb3;
  --neon-cyan: #7afcff;
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-border: rgba(255, 255, 255, 0.08);
}

/* Custom Scrollbars */
*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
*::-webkit-scrollbar-thumb:hover {
  background: var(--neon-pink);
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 126, 179, 0.2);
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: var(--neon-pink);
}

.social-container {
  height: calc(100vh - 110px);
  width: 100%;
  position: relative;
  overflow: hidden;
  background-color: transparent;
  color: var(--text-primary);
  padding: 0px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* Local glows removed in favor of global MainLayout glows */

.social-layout {
  display: flex;
  gap: 24px;
  flex: 1;
  min-height: 0;
  height: 100%; /* Explicit height */
  position: relative;
  z-index: 1;
}

.sidebar {
  width: 400px;
  flex-shrink: 0;
}

.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%; /* Take full height of parent */
  min-height: 0;
}

/* Sidebar */
.panel-header {
  padding: 24px;
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.panel-header h2 {
  margin: 0;
  font-size: 1.4rem;
}

.user-status-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--glass-border);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  cursor: pointer;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #555;
}
.status-dot.online {
  background: #00ff00;
  box-shadow: 0 0 8px #00ff00;
}

.nav-tabs {
  display: flex;
  padding: 16px 16px 0;
  gap: 6px;
  border-bottom: 1px solid var(--glass-border);
  overflow-x: auto;
  flex-wrap: nowrap;
  /* Hide scrollbar */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}
.nav-tabs::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}
.nav-tabs button {
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 0 8px 16px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 0.85rem;
}
.nav-tabs button.active {
  color: #ff7eb3;
}
.nav-tabs button.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 100%;
  height: 2px;
  background: #ff7eb3;
  box-shadow: 0 0 10px #ff7eb3;
}

.badge {
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
}
.badge.alert {
  background: #ff7eb3;
  color: white;
}

.search-box {
  margin: 20px 24px;
  position: relative;
}
.search-box input {
  width: 100%;
  padding: 10px 10px 10px 35px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
}
.search-box i {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #555;
}

.list-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  transition: background 0.2s;
  margin-bottom: 4px;
}
.list-item:hover {
  background: var(--glass-border);
}

.avatar-wrapper {
  position: relative;
  width: 42px;
  height: 42px;
}
.avatar-wrapper img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.status-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #1e1928;
}
.status-indicator.online {
  background: #00ff00;
}
.status-indicator.offline {
  background: #555;
}
.status-indicator.in-game {
  background: #ff7eb3;
}

.item-info {
  flex: 1;
  overflow: hidden;
}
.item-name {
  font-weight: 600;
  font-size: 0.95rem;
}
.item-status {
  font-size: 0.8rem;
  color: #777;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}
.list-item:hover .item-actions {
  opacity: 1;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--glass-border);
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-icon:hover {
  background: #ff7eb3;
}
.btn-icon.danger:hover {
  background: #ff4d4d;
  color: white;
}

/* Requests */
.avatar-sm {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}
.req-actions {
  display: flex;
  gap: 8px;
}
.btn-accept {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 255, 0, 0.2);
  color: #00ff00;
  cursor: pointer;
}
.btn-accept:hover {
  background: #00ff00;
  color: black;
}
.btn-reject {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 0, 0, 0.2);
  color: #ff4d4d;
  cursor: pointer;
}
.btn-reject:hover {
  background: #ff4d4d;
  color: white;
}

/* Empty States */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #777;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}
.empty-state i {
  font-size: 2rem;
  opacity: 0.5;
}
.btn-neon-sm {
  background: #ff7eb3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
}

/* Main Panel */
.main-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  align-items: stretch;
  background: rgba(0, 0, 0, 0.15);
  height: 100%;
}

.group-chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  position: relative; /* For absolute positioned input */
}

.main-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0; /* Critical for flex child scrolling */
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* Ensure empty state centers properly */
.empty-chat-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.empty-state-card {
  text-align: center;
  max-width: 320px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 40px 30px;
  border-radius: 32px;
  backdrop-filter: blur(10px);
}

.icon-glow {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: rgba(255, 126, 179, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 0 30px rgba(255, 126, 179, 0.1);
}

.icon-glow i {
  font-size: 2rem;
  color: var(--neon-pink);
}

.empty-state-card h2 {
  font-size: 1.4rem;
  margin-bottom: 12px;
  color: white;
}

.empty-state-card p {
  font-size: 0.9rem;
  color: #888;
  line-height: 1.5;
}
.add-friend-section {
  padding: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.search-box-large {
  display: flex;
  gap: 10px;
}
.social-autocomplete {
  flex: 1;
}
:deep(.autocomplete-input) {
  width: 100%;
  padding: 12px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
}
.hint-text {
  font-size: 0.85rem;
  color: #777;
  text-align: center;
}

/* Groups UI */
.groups-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--glass-border);
}
.btn-create-group {
  flex: 1;
  background: #ff7eb3;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn-create-group:hover {
  background: #ff5a9e;
}
.btn-icon-only {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--glass-border);
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-icon-only:hover {
  background: rgba(255, 255, 255, 0.1);
}
.item-badge {
  background: #ff7eb3;
  border-radius: 50%;
  width: 8px;
  height: 8px;
}

/* New Premium Chat Layout */
.message-row {
  display: flex;
  width: 100%;
  margin-bottom: 2px;
  padding: 0 4px;
}

.message-row.mine {
  justify-content: flex-end;
}

.message-row.group-start {
  margin-top: 14px;
}

.avatar-col {
  width: 40px;
  display: flex;
  align-items: flex-end;
  padding-bottom: 2px;
}

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.msg-content {
  max-width: 85%; /* Wider bubbles */
}

.msg-header {
  margin-bottom: 6px;
  margin-left: 12px;
}

.msg-username {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--neon-pink);
  text-transform: capitalize;
}

.msg-bubble {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px 16px;
  border-radius: 20px;
  border-top-left-radius: 4px; /* Distinct corner for start */
  position: relative;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.message-row.mine .msg-bubble {
  border-top-left-radius: 20px;
  border-top-right-radius: 4px;
}

.my-bubble {
  background: linear-gradient(135deg, rgba(255, 126, 179, 0.15) 0%, rgba(255, 90, 158, 0.08) 100%);
  border: 1px solid rgba(255, 126, 179, 0.3);
}

.msg-text {
  font-size: 0.95rem;
  line-height: 1.5;
  word-break: break-word;
  color: rgba(255, 255, 255, 0.95);
}

.msg-time-inline {
  font-size: 0.7rem;
  opacity: 0.4;
  margin-top: 6px;
  font-weight: 500;
  align-self: flex-end;
}

.chat-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px;
  color: #666;
}

/* Chat Input Glassmorphism - Sticky at bottom */
.chat-input-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 20px 20px;
  background: rgba(15, 10, 21, 0.95);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 10;
}

.input-glass-wrapper {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.3s ease;
}

.input-glass-wrapper:focus-within {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--neon-pink);
  box-shadow: 0 0 20px rgba(255, 126, 179, 0.1);
}

.input-glass-wrapper input {
  background: none;
  border: none;
  color: white;
  padding: 8px 4px;
  outline: none;
  font-size: 0.95rem;
}

.input-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.char-counter {
  font-size: 0.7rem;
  color: #666;
}

.btn-send-neon {
  background: var(--neon-pink);
  color: white;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 0 15px rgba(255, 126, 179, 0.3);
  transition: all 0.2s;
}

.btn-send-neon:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(255, 126, 179, 0.5);
}

.btn-send-neon:disabled {
  background: #333;
  box-shadow: none;
  opacity: 0.3;
  cursor: not-allowed;
}

/* Group Sidebar Panel */
.group-sidebar-panel {
  position: relative;
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--glass-border);
  /* border-radius removed as it triggers on right side of main panel */
  background: rgba(0, 0, 0, 0.2); /* Slightly darker to distinguish */
  height: 100%;
}
.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sidebar-header h3 {
  margin: 0;
  font-size: 1.1rem;
}
.btn-icon-sm {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--glass-border);
  border: none;
  color: var(--text-primary);
  cursor: pointer;
}
.btn-icon-sm:hover {
  background: rgba(255, 255, 255, 0.1);
}
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}
.member-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  transition: background 0.2s;
}
.member-item:hover {
  background: var(--glass-border);
}
.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--glass-border);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.member-info {
  flex: 1;
}
.member-name {
  font-size: 0.9rem;
  font-weight: 500;
}
.btn-add-friend-mini {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(127, 252, 255, 0.2);
  border: none;
  color: #7afcff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-add-friend-mini:hover {
  background: #7afcff;
  color: black;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.modal-content {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  overflow: hidden;
}
.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 {
  margin: 0;
  font-size: 1.3rem;
}
.btn-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 1.2rem;
}
.btn-close:hover {
  background: rgba(255, 255, 255, 0.1);
}
.modal-body {
  padding: 24px;
}
.form-group {
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 0.9rem;
}
.form-input,
.form-textarea {
  width: 100%;
  padding: 12px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: inherit;
}
.form-textarea {
  min-height: 100px;
  resize: vertical;
}
.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--glass-border);
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
.btn-secondary {
  padding: 10px 20px;
  background: var(--glass-border);
  border: none;
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}
.btn-primary {
  padding: 10px 20px;
  background: #ff7eb3;
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-weight: 600;
}
.btn-primary:hover {
  background: #ff5a9e;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.slide-left-enter-active,
.slide-left-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s;
}
.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Modern Groups Design - Compact */
.groups-list-modern {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px;
}

.groups-top-actions {
  display: flex;
  align-items: center;
}

.btn-primary-modern {
  flex: 1;
  background: linear-gradient(135deg, #ff7eb3 0%, #ff5a9e 100%);
  border: none;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(255, 126, 179, 0.2);
}
.btn-primary-modern:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 126, 179, 0.3);
}
.btn-primary-modern:active {
  transform: translateY(0);
}
.btn-primary-modern i {
  font-size: 0.9rem;
}

.empty-state-modern {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}
.empty-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255, 126, 179, 0.1) 0%, rgba(122, 252, 255, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.empty-icon i {
  font-size: 1.3rem;
  color: #ff7eb3;
  opacity: 0.5;
}
.empty-state-modern h4 {
  margin: 0 0 6px 0;
  font-size: 0.95rem;
  color: var(--text-primary);
}
.empty-state-modern p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  max-width: 200px;
}

.groups-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-card-modern {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 12px;
}
.group-card-modern::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #ff7eb3, #7afcff);
  opacity: 0;
  transition: opacity 0.2s;
}
.group-card-modern:hover {
  border-color: rgba(255, 126, 179, 0.4);
  transform: translateX(2px);
  background: rgba(255, 126, 179, 0.03);
}
.group-card-modern:hover::before {
  opacity: 1;
}
.group-card-modern.active {
  border-color: #ff7eb3;
  background: linear-gradient(135deg, rgba(255, 126, 179, 0.08) 0%, rgba(122, 252, 255, 0.03) 100%);
}
.group-card-modern.active::before {
  opacity: 1;
}

.group-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.group-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(255, 126, 179, 0.15), rgba(122, 252, 255, 0.15));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(255, 126, 179, 0.2);
  flex-shrink: 0;
}
.group-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.group-icon i {
  font-size: 1rem;
  color: #ff7eb3;
}

.group-card-badge {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ff7eb3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.7rem;
  flex-shrink: 0;
}

.group-card-body {
  flex: 1;
  min-width: 0;
}
.group-card-body h4 {
  margin: 0 0 4px 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
}
.group-card-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
}
.group-card-meta i {
  font-size: 0.7rem;
}
.group-status {
  background: rgba(122, 252, 255, 0.1);
  padding: 2px 6px;
  border-radius: 8px;
  color: #7afcff;
  font-size: 0.7rem;
  font-weight: 500;
}

/* Modern Chat Header */
.chat-header-modern {
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.1);
  object-fit: cover;
}

.header-info h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: #888;
  text-transform: capitalize;
}

.chat-header-actions {
  display: flex;
  gap: 8px;
}

.btn-action-ghost {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-action-ghost:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--neon-pink);
}

.group-icon-header {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(255, 126, 179, 0.2), rgba(122, 252, 255, 0.2));
  border: 1px solid rgba(255, 126, 179, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--neon-pink);
  font-size: 1rem;
}

.header-subtitle {
  font-size: 0.75rem;
  color: #888;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 24px 24px 140px 24px; /* Extra bottom padding for input area */
  display: flex;
  flex-direction: column;
  gap: 6px;
  overscroll-behavior: contain;
}

/* Custom Scrollbar for Chat */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}
.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}
.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
.chat-messages:hover::-webkit-scrollbar-thumb {
  background: rgba(255, 126, 179, 0.4);
}
</style>
