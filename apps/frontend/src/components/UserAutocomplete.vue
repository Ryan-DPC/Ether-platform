<script setup lang="ts">
import { ref, watch } from 'vue'
import axios from 'axios'


const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue', 'select'])

const searchQuery = ref(props.modelValue)
const results = ref<any[]>([])
const loading = ref(false)
const showDropdown = ref(false)

// Debounce function (implementing locally to avoid dependency issues if lodash isn't installed)
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

const performSearch = async (query: string) => {
  if (!query.trim()) {
    results.value = []
    showDropdown.value = false
    return
  }

  loading.value = true
  try {
    const response = await axios.get(`/users/search?q=${encodeURIComponent(query)}`)
    // Limit to 5 results as requested
    const data = response.data;
    const usersList = Array.isArray(data) ? data : (data.users || []);
    results.value = usersList.slice(0, 5);
    showDropdown.value = true
  } catch (error) {
    console.error('Search failed:', error)
    results.value = []
  } finally {
    loading.value = false
  }
}

const debouncedSearch = debounce(performSearch, 300)

watch(() => props.modelValue, (newVal) => {
  searchQuery.value = newVal
})

const onInput = (e: Event) => {
  const value = (e.target as HTMLInputElement).value
  searchQuery.value = value
  emit('update:modelValue', value)
  debouncedSearch(value)
}

const selectUser = (user: any) => {
  searchQuery.value = user.username
  emit('update:modelValue', user.username)
  emit('select', user)
  showDropdown.value = false
}

const closeDropdown = () => {
    // Small delay to allow click event to register
    setTimeout(() => {
        showDropdown.value = false
    }, 200)
}
</script>

<template>
  <div class="autocomplete-container">
    <div class="input-wrapper">
      <slot name="prefix-icon"></slot>
      <input
        type="text"
        :value="searchQuery"
        @input="onInput"
        @focus="debouncedSearch(searchQuery)"
        @blur="closeDropdown"
        :placeholder="placeholder"
        class="autocomplete-input"
      />
      <div v-if="loading" class="spinner">
        <i class="fas fa-circle-notch fa-spin"></i>
      </div>
    </div>

    <div v-if="showDropdown && (results.length > 0 || searchQuery)" class="dropdown-list">
      <div v-if="results.length > 0">
        <div
            v-for="user in results"
            :key="user._id || user.id"
            class="dropdown-item"
            @mousedown.prevent="selectUser(user)"
        >
            <div class="user-avatar-container">
                <img :src="user.profile_pic || '/default-avatar.svg'" class="user-pdp" alt="Avatar">
                <!-- Frame placeholder - assumes 'frame_url' or similar if it exists, otherwise generic if implied -->
                <img v-if="user.frame_url" :src="user.frame_url" class="user-frame" alt="Frame">
                <!-- If no frame url but we want to show a default style for frame -->
                <div v-else class="default-frame-overlay"></div>
            </div>
            <span class="username">{{ user.username }}</span>
        </div>
      </div>
      <div v-else-if="searchQuery && !loading" class="no-results">
        No users found
      </div>
    </div>
  </div>
</template>

<style scoped>
.autocomplete-container {
  position: relative;
  width: 100%;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.autocomplete-input {
  width: 100%;
  /* padding will be handled by parent or specific class override if needed, but defaults are good */
  /* Inherit styles from parent context usually works best, but providing basic structure */
  background: transparent;
  border: none;
  color: inherit;
  outline: none;
}

.spinner {
  position: absolute;
  right: 10px;
  color: #b0b9c3;
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: rgba(30, 25, 40, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  margin-top: 4px;
  max-height: 250px; /* Scrollable */
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
}

/* Scrollbar styling */
.dropdown-list::-webkit-scrollbar {
  width: 6px;
}
.dropdown-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.user-avatar-container {
  position: relative;
  width: 40px;
  height: 40px;
}

.user-pdp {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.user-frame {
  position: absolute;
  top: -5%; /* Adjust based on frame asset design */
  left: -5%;
  width: 110%;
  height: 110%;
  pointer-events: none;
  z-index: 2;
}

.default-frame-overlay {
    /* Optional: A default ring if no specific frame image is provided */
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid transparent; /* Or a specific color like #ff7eb3 if desired as a default frame */
    box-shadow: 0 0 0 2px rgba(0,0,0,0.2);
}

.username {
  color: white;
  font-size: 0.95rem;
  font-weight: 500;
}

.no-results {
  padding: 12px;
  text-align: center;
  color: #777;
  font-size: 0.9rem;
}
</style>
