<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

onMounted(() => {
    const code = route.query.code as string
    if (code) {
        // Redirect to backend with the code
        window.location.href = `https://vext-backend.onrender.com/api/auth/github/callback?code=${code}`
    } else {
        // If no code, go back to login
        window.location.href = '/login?error=No+code+received'
    }
})
</script>

<template>
    <div class="callback-container">
        <div class="loading">
            <div class="spinner"></div>
            <p>Completing GitHub Login...</p>
        </div>
    </div>
</template>

<style scoped>
.callback-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #1a1a1a;
    color: white;
}

.loading {
    text-align: center;
}

.spinner {
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-left-color: #4CAF50;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
</style>
