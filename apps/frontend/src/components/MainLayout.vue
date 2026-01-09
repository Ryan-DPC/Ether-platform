<script setup>
import { RouterView } from 'vue-router'
import Header from '@/components/Header.vue'
import Sidebar from '@/components/Sidebar.vue'
import FriendsPopup from '@/components/FriendsPopup.vue'
import NotificationPopup from '@/components/NotificationPopup.vue'
import { onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useLayoutStore } from '@/stores/layoutStore'

const userStore = useUserStore()
const layoutStore = useLayoutStore()

let pollInterval;

// onMounted(() => {
//   // Poll user profile every 10 seconds to keep tokens/balance updated
//   pollInterval = setInterval(() => {
//     if (userStore.isAuthenticated) {
//       userStore.fetchProfile().catch(err => console.error('Background profile sync failed', err));
//     }
//   }, 10000);
// });

// onUnmounted(() => {
//   if (pollInterval) clearInterval(pollInterval);
// });
</script>

<template>
  <div class="app-layout">
    <!-- Dynamic App Background -->
    <div 
      class="app-background" 
      :style="layoutStore.appBackground ? { backgroundImage: `url(${layoutStore.appBackground})` } : {}"
    ></div>

    <!-- Global Ambient Background (visible if no dynamic bg) -->
    <div v-if="!layoutStore.appBackground" class="bg-glow pink-glow"></div>
    <div v-if="!layoutStore.appBackground" class="bg-glow cyan-glow"></div>

    <Sidebar />
    
    <div class="content-area">
      <Header />
      
      <main class="main-content">
        <RouterView />
      </main>
      


      <FriendsPopup v-if="userStore.isAuthenticated" />
      <NotificationPopup v-if="userStore.isAuthenticated" />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  width: 100vw;
  padding-top: 0; /* Removed space for title bar overlay */
  background: transparent; /* Allow SakuraBackground to show through */
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
}

.app-background {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background-size: cover;
  background-position: center center;
  background-attachment: fixed;
  z-index: 0;
  transition: background-image 0.5s ease-in-out;
}

/* Global Glows */
.bg-glow {
  position: absolute;
  width: 800px; height: 800px;
  border-radius: 50%;
  filter: blur(150px);
  opacity: 0.15;
  pointer-events: none;
  z-index: 0;
}
.pink-glow { top: -300px; left: -200px; background: #ff7eb3; }
.cyan-glow { bottom: -300px; right: -200px; background: #7afcff; }

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  z-index: 1; /* Ensure content is above bg */
  background: transparent; /* Let bg show through */
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  position: relative;
}

/* Scrollbar styling for main content */
.main-content::-webkit-scrollbar {
  width: 8px;
}

.main-content::-webkit-scrollbar-track {
  background: transparent;
}

.main-content::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.main-content::-webkit-scrollbar-thumb:hover {
  background: var(--accent-primary);
}
</style>
