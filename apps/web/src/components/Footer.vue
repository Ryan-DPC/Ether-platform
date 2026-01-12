<script setup lang="ts">
</script>

<template>
  <footer class="footer">
    <div class="container footer-content">
      <div class="brand">
        <h3>VEXT</h3>
        <p>© 2026 Vext Platform. All rights reserved.</p>
      </div>
      <div class="links">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Service</a>
        <a href="#">Contact</a>
      </div>
      <div class="socials">
        <span>🐦</span>
        <span>🎮</span>
        <span>👾</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  padding: 50px 0;
  background: black;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.brand h3 {
  font-weight: 800;
  letter-spacing: 2px;
  margin-bottom: 5px;
}

.brand p {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.links {
  display: flex;
  gap: 30px;
}

.links a {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.links a:hover {
  color: white;
}

.socials {
  display: flex;
  gap: 20px;
  font-size: 1.2rem;
  cursor: pointer;
}
</style>
