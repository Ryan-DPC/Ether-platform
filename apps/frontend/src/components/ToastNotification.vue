<script setup lang="ts">
import { useToastStore } from '../stores/toastStore'
import { storeToRefs } from 'pinia'

const toastStore = useToastStore()
const { toasts } = storeToRefs(toastStore)
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div 
        v-for="toast in toasts" 
        :key="toast.id" 
        :class="['toast', `toast-${toast.type}`]"
      >
        <div class="toast-content">
          <p>{{ toast.message }}</p>
          <button 
            v-if="toast.action" 
            @click="toast.action.callback"
            class="toast-action"
          >
            {{ toast.action.label }}
          </button>
        </div>
        <button @click="toastStore.removeToast(toast.id)" class="toast-close">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none; /* Allow clicks through container */
}

.toast {
  pointer-events: auto; /* Re-enable clicks on toasts */
  min-width: 250px;
  max-width: 350px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #2a2a2a;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-left: 4px solid transparent;
}

.toast-info { border-left-color: #4a9eff; }
.toast-success { border-left-color: #00ff00; }
.toast-error { border-left-color: #ff4a4a; }
.toast-warning { border-left-color: #ffaa00; }

.toast-content p {
  margin: 0;
  font-size: 13px;
  line-height: 1.3;
}

.toast-action {
  margin-top: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.toast-action:hover {
  background: rgba(255, 255, 255, 0.2);
}

.toast-close {
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.toast-close:hover {
  color: #fff;
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
