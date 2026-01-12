<script setup lang="ts">
const features = [
  {
    title: 'Universal Launcher',
    desc: 'Launch all your games from one single, optimized interface.',
    icon: '🚀'
  },
  {
    title: 'Cross-Platform',
    desc: 'Play anywhere. Your progress syncs across all your devices.',
    icon: '🔄'
  },
  {
    title: 'Social Hub',
    desc: 'Chat, trade, and team up with friends directly from the overlay.',
    icon: '💬'
  }
]
</script>

<template>
  <section id="features" class="features-section">
    <div class="container">
      <h2 class="section-title">Why <span class="gradient-text">Vext?</span></h2>
      
      <div class="features-grid">
        <div v-for="feat in features" :key="feat.title" class="feature-card glass-panel">
          <div class="feature-icon">{{ feat.icon }}</div>
          <h3>{{ feat.title }}</h3>
          <p>{{ feat.desc }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.features-section {
  padding: 100px 0;
  position: relative;
}

.section-title {
  text-align: center;
  font-size: 3rem;
  margin-bottom: 60px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
}

.feature-card {
  padding: 40px;
  text-align: center;
  transition: transform 0.3s;
}

.feature-card:hover {
  transform: translateY(-10px);
  background: rgba(255, 255, 255, 0.05);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 20px;
}

h3 {
  font-size: 1.5rem;
  margin-bottom: 15px;
  color: white;
}

p {
  color: var(--text-secondary);
}
</style>
