import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useLayoutStore = defineStore('layout', () => {
  const appBackground = ref<string | null>(null);

  function setBackground(url: string | null) {
    appBackground.value = url;
  }

  return {
    appBackground,
    setBackground,
  };
});
