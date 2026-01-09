<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h3>📁 Configuration du dossier d'installation</h3>
        <button @click="close" class="close-btn">&times;</button>
      </div>
      
      <div class="modal-body">
        <p>Choisissez où installer vos jeux VEXT.</p>
        <p class="info">Un sous-dossier "VEXT" sera créé automatiquement.</p>
        
        <div class="form-group">
          <label for="install-path">Chemin d'installation</label>
          <div class="input-with-button">
            <input 
              id="install-path"
              v-model="installPath" 
              type="text" 
              placeholder="C:/Games ou D:/MesJeux"
              @keyup.enter="confirm"
            >
            <button 
              v-if="isDesktop" 
              @click="browseFolder" 
              type="button"
              class="btn-browse"
            >
              📁 Parcourir...
            </button>
          </div>
          <small class="hint">
            Exemples: C:/Games, D:/MesJeux, C:/Users/VotreNom/Documents/Games
          </small>
        </div>

        <div class="form-actions">
          <button @click="confirm" class="btn-primary" :disabled="!installPath">
            Confirmer
          </button>
          <button @click="close" class="btn-secondary">
            Annuler
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import tauriAPI from '../tauri-adapter';

const isVisible = ref(false)
const installPath = ref('')
const resolveCallback = ref<((value: string | null) => void) | null>(null)
const isDesktop = ref(false)

onMounted(async () => {
  // Check if running in Tauri
  if ((window as any).__TAURI__) {
    isDesktop.value = true
  }
})

const show = (): Promise<string | null> => {
  installPath.value = ''
  isVisible.value = true
  
  return new Promise((resolve) => {
    resolveCallback.value = resolve
  })
}

const close = () => {
  isVisible.value = false
  if (resolveCallback.value) {
    resolveCallback.value(null)
    resolveCallback.value = null
  }
}

const confirm = () => {
  if (!installPath.value) return
  
  isVisible.value = false
  if (resolveCallback.value) {
    resolveCallback.value(installPath.value)
    resolveCallback.value = null
  }
}

const browseFolder = async () => {
  if (!(window as any).__TAURI__) return
  
  const selectedPath = await tauriAPI.selectFolder()
  if (selectedPath) {
    installPath.value = selectedPath
  }
}

defineExpose({ show, close })
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background: #1e1e1e;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #333;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.3rem;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: #888;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #fff;
}

.modal-body {
  padding: 30px;
}

.modal-body p {
  margin-bottom: 10px;
  color: #ccc;
}

.info {
  font-size: 0.9rem;
  color: #888;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #fff;
}

.input-with-button {
  display: flex;
  gap: 8px;
}

.form-group input {
  flex: 1;
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 1rem;
}

.btn-browse {
  padding: 12px 20px;
  background: #333;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 0.95rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.btn-browse:hover {
  background: #444;
  border-color: #555;
}

.form-group input:focus {
  outline: none;
  border-color: #4a9eff;
}

.hint {
  display: block;
  margin-top: 8px;
  font-size: 0.85rem;
  color: #666;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn-primary, .btn-secondary {
  flex: 1;
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #4a9eff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #3a8eef;
}

.btn-primary:disabled {
  background: #333;
  color: #666;
  cursor: not-allowed;
}

.btn-secondary {
  background: #333;
  color: #ccc;
}

.btn-secondary:hover {
  background: #444;
  color: #fff;
}
</style>
