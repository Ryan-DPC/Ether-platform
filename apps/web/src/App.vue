<script setup lang="ts">
import NavBar from './components/NavBar.vue'
import HeroSection from './components/HeroSection.vue'
import FeatureGrid from './components/FeatureGrid.vue'
import DownloadSection from './components/DownloadSection.vue'
import Footer from './components/Footer.vue'
</script>

<template>
  <div class="app-layout">
    <NavBar />
    <HeroSection />
    <FeatureGrid />
    <DownloadSection />
    <Footer />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
}
</style>
