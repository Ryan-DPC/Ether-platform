<script setup lang="ts">
</script>

<template>
  <section class="hero-section">
    <div class="hero-bg"></div>
    <div class="container hero-content">
      <h1 class="main-title">
        The Future of <br>
        <span class="gradient-text neon-text">Decentralized Gaming</span>
      </h1>
      <p class="subtitle">
        Your unified launcher for the Web3 gaming era. 
        Connect, play, and own your assets across unlimited worlds.
      </p>
      
      <div class="cta-group">
        <a href="#download" class="btn-primary">
          Get Started <span class="arrow">→</span>
        </a>
        <a href="#features" class="btn-secondary">
          Explore Features
        </a>
      </div>

      <div class="hero-stats glass-panel">
        <div class="stat-item">
          <span class="stat-number">100+</span>
          <span class="stat-label">Games Supported</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-number">Zero</span>
          <span class="stat-label">Platform Fees</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-number">100%</span>
          <span class="stat-label">Community Owned</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-section {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding-top: 80px;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: radial-gradient(circle at 50% 30%, rgba(20, 20, 40, 0), rgba(10, 10, 18, 1)),
              url('/bg-hero.jpg') center/cover no-repeat;
  z-index: -1;
  opacity: 0.4;
}

/* Simulated bg fallback */
.hero-bg::before {
  content: '';
  position: absolute;
  top: 20%; left: 50%;
  width: 600px; height: 600px;
  background: var(--primary-neon);
  filter: blur(150px);
  transform: translate(-50%, -50%);
  border-radius: 50%;
  opacity: 0.15;
  animation: pulse 4s infinite alternate;
}

.hero-content {
  text-align: center;
  max-width: 800px;
}

.main-title {
  font-size: 4.5rem;
  line-height: 1.1;
  margin-bottom: 2rem;
  font-weight: 800;
  letter-spacing: -1px;
}

.subtitle {
  font-size: 1.25rem;
  color: var(--text-secondary);
  margin-bottom: 3rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.cta-group {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 5rem;
}

.btn-primary {
  background: white;
  color: black;
  padding: 16px 40px;
  border-radius: 30px;
  font-weight: 700;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-primary:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.4);
}

.btn-secondary {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  color: white;
  padding: 16px 40px;
  border-radius: 30px;
  font-weight: 600;
  font-size: 1.1rem;
}

.btn-secondary:hover {
  background: rgba(255,255,255,0.2);
}

.hero-stats {
  display: flex;
  justify-content: space-around;
  padding: 30px;
  margin-top: 2rem;
  animation: float 6s ease-in-out infinite;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 800;
  color: white;
}

.stat-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-divider {
  width: 1px;
  background: rgba(255,255,255,0.1);
}

@keyframes pulse {
  0% { opacity: 0.1; transform: translate(-50%, -50%) scale(0.9); }
  100% { opacity: 0.2; transform: translate(-50%, -50%) scale(1.1); }
}

@media (max-width: 768px) {
  .main-title { font-size: 2.5rem; }
  .hero-stats { flex-direction: column; gap: 20px; }
  .stat-divider { display: none; }
}
</style>
