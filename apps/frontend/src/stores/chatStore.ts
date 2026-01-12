import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useChatStore = defineStore('chat', () => {
  const activeChatFriend = ref<any>(null);

  const openChat = (friend: any) => {
    activeChatFriend.value = friend;
  };

  const closeChat = () => {
    activeChatFriend.value = null;
  };

  return {
    activeChatFriend,
    openChat,
    closeChat,
  };
});
