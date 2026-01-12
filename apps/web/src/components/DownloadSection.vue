<script setup lang="ts">
</script>

<template>
  <section id="download" class="download-section">
    <div class="container">
      <div class="download-box glass-panel">
        <div class="content">
          <h2>Ready to Enter the <span class="neon-text">Verse?</span></h2>
          <p>Download the Vext Launcher now and start your journey.</p>
          
          <div class="buttons">
            <button class="btn-download windows">
              <span class="icon">🪟</span> Download for Windows
            </button>
            <button class="btn-download mac">
              <span class="icon">🍎</span> Download for Mac
            </button>
          </div>
          
          <p class="version-info">Version 1.0.2 • Windows 10/11 • 64-bit</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.download-section {
  padding: 100px 0;
}

.download-box {
  background: linear-gradient(135deg, rgba(30,30,45,0.8), rgba(10,10,20,0.9));
  padding: 80px;
  text-align: center;
  border: 1px solid var(--primary-neon);
  box-shadow: 0 0 50px rgba(255, 0, 85, 0.15);
}

h2 {
  font-size: 3rem;
  margin-bottom: 20px;
}

p {
  color: var(--text-secondary);
  font-size: 1.2rem;
  margin-bottom: 40px;
}

.buttons {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-download {
  padding: 15px 40px;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s;
}

.windows {
  background: var(--primary-neon);
  color: white;
}

.windows:hover {
  background: #ff3377;
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(255, 0, 85, 0.4);
}

.mac {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.2);
  color: white;
}

.mac:hover {
  background: rgba(255,255,255,0.1);
}

.version-info {
  margin-top: 30px;
  font-size: 0.9rem;
  opacity: 0.6;
  margin-bottom: 0;
}
</style>
