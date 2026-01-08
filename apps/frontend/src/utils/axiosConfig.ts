import axios from 'axios'

const isTauri = !!(window as any).__TAURI__;
const isElectron = !!(window as any).electronAPI;

const getBaseURL = () => {
    // If VITE_API_URL is explicitly set, use it
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL
    }

    // Hardcoded production fallback for Desktop App
    if (import.meta.env.PROD && (isTauri || isElectron)) {
        return 'https://ether-backend-n24i.onrender.com/api'
    }

    // In Desktop App (Tauri/Electron) DEV mode, use localhost
    if (isTauri || isElectron) {
        return 'http://localhost:3001/api'
    }

    // In dev mode (with Vite proxy), use relative path
    return '/api'
}

axios.defaults.baseURL = getBaseURL()
axios.defaults.headers.common['Content-Type'] = 'application/json'

// Request interceptor - automatically add Authorization header
axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }

        // Log requests in development
        if (import.meta.env.DEV) {
            console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`, config.data || '')
        }

        return config
    },
    (error) => {
        console.error('❌ Request error:', error)
        return Promise.reject(error)
    }
)

// Response interceptor - handle errors globally
axios.interceptors.response.use(
    (response) => {
        // Log successful responses in development
        if (import.meta.env.DEV) {
            console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data)
        }
        return response
    },
    (error) => {
        // Handle 401 Unauthorized - redirect to login
        if (error.response?.status === 401) {
            console.warn('⚠️ Unauthorized access, redirecting to login...')
            localStorage.removeItem('token')
            sessionStorage.removeItem('token')
            window.location.href = '/login'
        }

        // Log detailed error information
        console.error('❌ API Error:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            data: error.response?.data
        })

        return Promise.reject(error)
    }
)

export default axios
