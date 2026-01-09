<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '../stores/userStore'
import { useThemeStore } from '../stores/themeStore' // Import Theme Store
// import { useItemStore } from '../stores/itemStore'   // Import Item Store
import logoImage from '@/assets/images/Logo.svg'
import SakuraBackground from '@/components/SakuraBackground.vue'

const logo = logoImage
const userStore = useUserStore()
const themeStore = useThemeStore()
// const itemStore = useItemStore()
const { t, locale } = useI18n()


const activeTab = ref('Account')
const tabs = ['Account', 'Profile', 'Security', 'Notifications', 'Appearance'] // Added Appearance tab

const form = reactive({
  username: '',
  email: '',
  language: 'English',
  bio: '',
  social_links: {
    twitter: '',
    discord: '',
    website: ''
  },
  notification_preferences: {
    email_updates: true,
    push_notifications: true,
    marketing_emails: false
  }
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const statusMessage = ref('')
const statusType = ref('')

onMounted(async () => {
  if (!userStore.user) {
    await userStore.fetchProfile()
  }
  if (userStore.user) {
    form.username = userStore.user.username || ''
    form.email = userStore.user.email || ''
    form.language = userStore.user.language || 'English'
    form.bio = userStore.user.bio || ''
    if (userStore.user.social_links) {
      form.social_links = { ...userStore.user.social_links }
    }
    if (userStore.user.notification_preferences) {
      form.notification_preferences = { ...userStore.user.notification_preferences }
    }
  }
})

// Watcher removed to defer language change

const saveChanges = async () => {
  statusMessage.value = ''
  
  if (!userStore.user) return

  const payload: any = {}
  let hasChanges = false

  // Check primitive fields
  if (form.username !== userStore.user.username) {
      payload.username = form.username
      hasChanges = true
  }
  if (form.email !== userStore.user.email) {
      payload.email = form.email
      hasChanges = true
  }
  if (form.language !== userStore.user.language) {
      payload.language = form.language
      hasChanges = true
  }
  if (form.bio !== userStore.user.bio) {
      payload.bio = form.bio
      hasChanges = true
  }

  // Check objects
  if (JSON.stringify(form.social_links) !== JSON.stringify(userStore.user.social_links)) {
      payload.social_links = form.social_links
      hasChanges = true
  }
  if (JSON.stringify(form.notification_preferences) !== JSON.stringify(userStore.user.notification_preferences)) {
      payload.notification_preferences = form.notification_preferences
      hasChanges = true
  }

  if (!hasChanges) {
      statusMessage.value = 'No changes to save.'
      statusType.value = 'info'
      setTimeout(() => { statusMessage.value = '' }, 3000)
      return
  }

  try {
    await userStore.updateProfile(payload)
    
    // Apply language change only on save
    if (payload.language) {
        locale.value = payload.language
    }
    
    statusMessage.value = 'Settings saved successfully!'
    statusType.value = 'success'
    
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)
  } catch (error: any) {
    statusMessage.value = error.response?.data?.message || 'Failed to save settings.'
    statusType.value = 'error'
  }
}

const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        statusMessage.value = 'Passwords do not match.'
        statusType.value = 'error'
        return
    }
    // TODO: Implement password change endpoint
    statusMessage.value = 'Password change not yet implemented.'
    statusType.value = 'info'
}

// === Theme & Plugins Logic ===
const availableThemes = [
    { id: 'default', name: 'VEXT Default', previewColor: '#ff7eb3' },
    { id: 'cyberpunk', name: 'Cyberpunk', previewColor: '#00f3ff', requiredItem: 'Theme: Cyberpunk' },
    { id: 'retro', name: 'Synthwave Retro', previewColor: '#ff2a6d', requiredItem: 'Theme: Retro' },
    { id: 'minimal', name: 'Minimalist', previewColor: '#ffffff' }
]

const selectTheme = (themeId: string) => {
    /* 
       // Logic for Item Check (commented out for functionality demo, can be enabled if items exist)
       const theme = availableThemes.find(t => t.id === themeId);
       if (theme?.requiredItem) {
           const hasItem = itemStore.myItems.find(i => i.name === theme.requiredItem);
           if (!hasItem) {
               statusMessage.value = `You need to own '${theme.requiredItem}' to use this theme!`;
               statusType.value = 'error';
               return;
           }
       }
    */
    themeStore.setTheme(themeId);
}

const addNewPlugin = () => {
    // Mock user adding a plugin
    const name = prompt("Enter Plugin Name (e.g. 'Damage Meter')");
    if (name) {
        themeStore.addPlugin({
            name,
            version: '1.0.0',
            enabled: true
        });
    }
}
</script>

<template>
  <div class="settings-page">
    <SakuraBackground />

    <div class="settings-container">
      <!-- Sidebar -->
      <div class="settings-sidebar">
        <div class="sidebar-header">
          <img :src="logo" alt="VEXT Logo" class="sidebar-logo" />
        </div>
        <nav class="sidebar-nav">
          <div 
            v-for="tab in tabs" 
            :key="tab"
            class="nav-item"
            :class="{ active: activeTab === tab }"
            @click="activeTab = tab"
          >
            {{ t(`settings.tabs.${tab}`) }}
          </div>
        </nav>
      </div>

      <!-- Content -->
      <div class="settings-content">
        <h1 class="page-title">{{ t('settings.title', { tab: t(`settings.tabs.${activeTab}`) }) }}</h1>

        <!-- ACCOUNT TAB -->
        <div v-if="activeTab === 'Account'" class="tab-content">
            <div class="form-group">
            <label>{{ t('settings.account.username') }}</label>
            <div class="input-wrapper">
                <input v-model="form.username" type="text" />
            </div>
            </div>

            <div class="form-group">
            <label>{{ t('settings.account.email') }}</label>
            <div class="input-wrapper">
                <input v-model="form.email" type="email" />
            </div>
            </div>

            <div class="form-group">
            <label>{{ t('settings.account.language') }}</label>
            <div class="input-wrapper">
                <select v-model="form.language">
                <option>English</option>
                <option>French</option>
                <option>Spanish</option>
                </select>
                <i class="fas fa-chevron-down input-icon"></i>
            </div>
            </div>
        </div>

        <!-- PROFILE TAB -->
        <div v-if="activeTab === 'Profile'" class="tab-content">
            <div class="form-group">
                <label>{{ t('settings.account.bio') }}</label>
                <div class="input-wrapper">
                    <textarea v-model="form.bio" rows="4" placeholder="Tell us about yourself..."></textarea>
                </div>
            </div>
            
            <div class="section-label">{{ t('settings.account.social_links') }}</div>
            <div class="form-group">
                <label>{{ t('settings.account.twitter') }}</label>
                <div class="input-wrapper">
                    <input v-model="form.social_links.twitter" type="text" placeholder="@username" />
                </div>
            </div>
            <div class="form-group">
                <label>{{ t('settings.account.discord') }}</label>
                <div class="input-wrapper">
                    <input v-model="form.social_links.discord" type="text" placeholder="username#0000" />
                </div>
            </div>
            <div class="form-group">
                <label>{{ t('settings.account.website') }}</label>
                <div class="input-wrapper">
                    <input v-model="form.social_links.website" type="text" placeholder="https://example.com" />
                </div>
            </div>
        </div>

        <!-- SECURITY TAB -->
        <div v-if="activeTab === 'Security'" class="tab-content">
            <div class="form-group">
                <label>{{ t('settings.security.current_password') }}</label>
                <div class="input-wrapper">
                    <input v-model="passwordForm.currentPassword" type="password" />
                </div>
            </div>
            <div class="form-group">
                <label>{{ t('settings.security.new_password') }}</label>
                <div class="input-wrapper">
                    <input v-model="passwordForm.newPassword" type="password" />
                </div>
            </div>
            <div class="form-group">
                <label>{{ t('settings.security.confirm_password') }}</label>
                <div class="input-wrapper">
                    <input v-model="passwordForm.confirmPassword" type="password" />
                </div>
            </div>
            <button class="save-btn" @click="changePassword">{{ t('settings.security.update_btn') }}</button>
        </div>



        <!-- APPEARANCE TAB -->
        <div v-if="activeTab === 'Appearance'" class="tab-content">
            <div class="section-label">{{ t('settings.appearance.display_mode') }}</div>
            <div class="toggle-group">
                <div class="toggle-item">
                    <div class="toggle-info">
                        <span class="toggle-label">{{ t('settings.appearance.dark_mode') }}</span>
                        <span class="toggle-desc">{{ t('settings.appearance.dark_mode_desc') }}</span>
                    </div>
                    <label class="switch">
                        <input type="checkbox" :checked="themeStore.darkMode" @change="themeStore.toggleDarkMode()">
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>

            <div class="section-label">{{ t('settings.appearance.themes') }}</div>
            <div class="themes-grid">
                <div 
                    v-for="theme in availableThemes" 
                    :key="theme.id" 
                    class="theme-card"
                    :class="{ active: themeStore.currentTheme === theme.id }"
                    @click="selectTheme(theme.id)"
                >
                    <div class="theme-preview" :style="{ background: theme.previewColor }"></div>
                    <div class="theme-info">
                        <div class="theme-name">{{ theme.name }}</div>
                        <div v-if="theme.requiredItem" class="theme-req">
                            <i class="fas fa-lock" style="font-size: 0.8em; margin-right: 5px;"></i> {{ theme.requiredItem }}
                        </div>
                    </div>
                </div>
            </div>

            <div class="section-label">{{ t('settings.appearance.community_plugins') }}</div>
            <div class="plugins-list">
                <div v-if="themeStore.plugins.length === 0" class="empty-plugins">
                    {{ t('settings.appearance.no_plugins') }}
                </div>
                <div v-for="(plugin, index) in themeStore.plugins" :key="index" class="plugin-item">
                    <div class="plugin-details">
                        <span class="plugin-name">{{ plugin.name }}</span>
                        <span class="plugin-version">v{{ plugin.version }}</span>
                    </div>
                    <div class="plugin-actions">
                         <button class="remove-btn" @click="themeStore.removePlugin(index)">{{ t('settings.appearance.remove') }}</button>
                    </div>
                </div>
                <button class="add-plugin-btn" @click="addNewPlugin()">{{ t('settings.appearance.install_plugin') }}</button>
            </div>
        </div>

        <button v-if="activeTab !== 'Security'" class="save-btn" @click="saveChanges" :disabled="userStore.isLoading">
          {{ userStore.isLoading ? t('settings.saving') : t('settings.save_btn') }}
        </button>
        
        <div v-if="statusMessage" class="status-message" :class="statusType">
          {{ statusMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.settings-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  padding: 40px;
  font-family: 'Inter', sans-serif;
  color: var(--text-primary);
  position: relative;
}

.settings-container {
  display: flex;
  width: 100%;
  max-width: 900px;
  min-height: 600px;
  background: transparent;
  gap: 40px;
}

/* Sidebar */
.settings-sidebar {
  width: 250px;
  background: var(--glass-bg);
  border-radius: 20px;
  padding: 30px 0;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
}

.sidebar-header {
  padding: 0 30px 40px;
  display: flex;
  justify-content: center;
}

.sidebar-logo {
  width: 60px;
  height: 60px;
  filter: drop-shadow(0 0 10px rgba(255, 126, 179, 0.3));
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  background: transparent;  
}

.nav-item {
  padding: 15px 30px;
  cursor: pointer;
  color: var(--text-secondary);
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
  font-size: 1.1rem;
}

.nav-item:hover {
  color: var(--text-primary);
  background: var(--glass-border);
}

.nav-item.active {
  color: var(--text-primary);
  font-weight: 600;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: #ff7eb3;
  box-shadow: 0 0 10px #ff7eb3;
}

/* Content */
.settings-content {
  flex: 1;
  padding: 20px 0;
  width: 100%; /* Ensure full width */
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 40px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.form-group {
  margin-bottom: 25px;
}

.form-group label {
  display: block;
  color: #8a8a9b;
  margin-bottom: 10px;
  font-size: 0.95rem;
}

.input-wrapper {
  position: relative;
  background: var(--glass-bg);
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  transition: border-color 0.3s;
}

.input-wrapper:focus-within {
  border-color: #ff7eb3;
}

.input-wrapper input,
.input-wrapper select,
.input-wrapper textarea {
  width: 100%;
  background: transparent;
  border: none;
  padding: 15px 20px;
  color: var(--text-primary);
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  appearance: none;
  resize: none; /* For textarea */
}

/* Fix for invisible text in dropdown options */
.input-wrapper select option {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
}


.change-link {
  color: #ff7eb3;
  padding: 0 20px;
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
}

.input-icon {
  padding: 0 20px;
  color: #8a8a9b;
  pointer-events: none;
}

.save-btn {
  margin-top: 20px;
  width: 100%;
  padding: 15px;
  background: #ff7eb3;
  border: none;
  border-radius: 12px;
  color: white;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.save-btn:hover {
  background: #ff5c9e;
  box-shadow: 0 0 20px rgba(255, 126, 179, 0.4);
  transform: translateY(-2px);
}

.save-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.status-message {
  margin-top: 15px;
  padding: 10px;
  border-radius: 8px;
  text-align: center;
  font-weight: 500;
}

.status-message.success {
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
  border: 1px solid rgba(46, 204, 113, 0.3);
}

.status-message.error {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.3);
}

.status-message.info {
  background: rgba(52, 152, 219, 0.2);
  color: #3498db;
  border: 1px solid rgba(52, 152, 219, 0.3);
}

.section-label {
    color: var(--text-primary);
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 20px;
    margin-top: 30px;
    border-bottom: 1px solid var(--glass-border);
    padding-bottom: 10px;
}

/* Toggle Switch */
.toggle-group {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.toggle-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    padding: 15px;
    background: var(--glass-bg);
    border-radius: 12px;
    border: 1px solid var(--glass-border);
}

.toggle-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.toggle-label {
    font-weight: 600;
    color: var(--text-primary);
}

.toggle-desc {
    font-size: 0.85rem;
.toggle-desc {
    font-size: 0.85rem;
    color: var(--text-secondary);
}
}

.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 26px;
}

.switch input { 
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #2c2c3a;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
}

input:checked + .slider {
  background-color: #ff7eb3;
}

input:focus + .slider {
  box-shadow: 0 0 1px #ff7eb3;
}

input:checked + .slider:before {
  transform: translateX(24px);
}

/* Rounded sliders */
.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

/* Themes Grid */
.themes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 20px;
}

.theme-card {
    background: var(--bg-secondary);
    border: 2px solid transparent;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 10px;
}

.theme-card:hover {
    transform: translateY(-5px);
    border-color: var(--accent-color);
}

.theme-card.active {
    border-color: var(--accent-color);
    box-shadow: 0 0 15px var(--accent-glow);
}

.theme-preview {
    height: 80px;
    border-radius: 8px;
    margin-bottom: 10px;
    box-shadow: inset 0 0 10px rgba(0,0,0,0.2);
}

.theme-info {
    text-align: center;
}

.theme-name {
    font-weight: 600;
    color: var(--text-primary);
}

.theme-req {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 5px;
}

/* Plugins */
.plugins-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.plugin-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
}

.plugin-details {
    display: flex;
    flex-direction: column;
}

.plugin-name {
    font-weight: 600;
    color: var(--text-primary);
}

.plugin-version {
    font-size: 0.8rem;
    color: var(--text-secondary);
}

.remove-btn {
    background: rgba(231, 76, 60, 0.2);
    color: #e74c3c;
    border: 1px solid rgba(231, 76, 60, 0.3);
    padding: 5px 10px;
    font-size: 0.8rem;
}

.remove-btn:hover {
    background: rgba(231, 76, 60, 0.4);
}

.add-plugin-btn {
    margin-top: 15px;
    background: transparent;
    border: 2px dashed var(--border-color);
    color: var(--text-secondary);
    padding: 15px;
}

.add-plugin-btn:hover {
    border-color: var(--accent-color);
    color: var(--accent-color);
}
</style>
