<script setup lang="ts">
</script>

<template>
  <nav class="navbar glass-panel">
    <div class="container nav-content">
      <div class="logo">
        <span class="vext-logo">VEXT</span>
      </div>
      <div class="nav-links">
        <a href="#features">Features</a>
        <a href="#community">Community</a>
        <a href="#download" class="btn-download">Download</a>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 1200px;
  z-index: 1000;
  padding: 15px 0;
}

.nav-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.vext-logo {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 2px;
  background: linear-gradient(to right, #ffffff, #a0a0b0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-links {
  display: flex;
  gap: 30px;
  align-items: center;
}

.nav-links a {
  font-weight: 500;
  font-size: 0.95rem;
}

.nav-links a:hover {
  color: var(--secondary-neon);
}

.btn-download {
  background: var(--primary-neon);
  color: white;
  padding: 8px 24px;
  border-radius: 20px;
  font-weight: 600;
  box-shadow: 0 0 10px rgba(255, 0, 85, 0.3);
}

.btn-download:hover {
  box-shadow: 0 0 20px rgba(255, 0, 85, 0.6);
  transform: translateY(-2px);
}
</style>
