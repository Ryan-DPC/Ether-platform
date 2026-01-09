import { defineStore } from 'pinia'
import axios from 'axios'
import { socketService } from '../services/socket'
import { getApiUrl } from '../utils/url'

function sanitizeUser(user: any) {
    if (user && user.profile_pic) {
        // Replace localhost:3001 with the correct API URL
        user.profile_pic = user.profile_pic.replace('http://localhost:3001', getApiUrl());
    }
    return user;
}

export const useUserStore = defineStore('user', {
    state: () => ({
        user: null as any,
        isAuthenticated: false,
        isLoading: false,
        friendRequests: [] as any[],
        friends: [] as any[]
    }),
    actions: {
        async fetchProfile() {
            this.isLoading = true
            try {
                const response = await axios.get('/users/me')

                // Elysia returns the user object directly for /users/me, 
                // whereas Express might have returned { success: true, user: ... }
                // We check for both structures to support both legacy and new backend.
                const userData = response.data.user || response.data;

                if (userData && userData.username) {
                    this.user = sanitizeUser(userData)
                    this.isAuthenticated = true
                } else {
                    this.isAuthenticated = false
                    this.user = null
                }
            } catch (error) {
                console.error('Failed to fetch profile:', error)
                this.isAuthenticated = false
                this.user = null
                throw error
            } finally {
                this.isLoading = false
            }
        },
        async updateProfile(data: any) {
            this.isLoading = true
            try {
                const response = await axios.put('/users/me', data)
                if (response.data && response.data.user) {
                    this.user = sanitizeUser(response.data.user)
                    return response.data
                }
            } catch (error) {
                console.error('Failed to update profile:', error)
                throw error
            } finally {
                this.isLoading = false
            }
        },
        async login(identifier: string, password: string, remember: boolean = false) {
            this.isLoading = true
            try {
                const response = await axios.post('/auth/login', { username: identifier, password })
                if (response.data && response.data.token) {
                    const token = response.data.token

                    if (remember) {
                        localStorage.setItem('token', token)
                        sessionStorage.removeItem('token')
                    } else {
                        sessionStorage.setItem('token', token)
                        localStorage.removeItem('token')
                    }

                    this.isAuthenticated = true

                    // Fetch user profile
                    await this.fetchProfile()

                    // Connect WebSocket after successful login
                    console.log('🔌 Connecting to WebSocket...')
                    socketService.connect(token)
                }
            } catch (error) {
                console.error('Login failed:', error)
                throw error
            } finally {
                this.isLoading = false
            }
        },
        initializeAuth() {
            // Check both storages
            const token = localStorage.getItem('token') || sessionStorage.getItem('token')

            if (token) {
                console.log('🔌 Connecting to WebSocket (initializeAuth)...')
                socketService.connect(token)
            }
            return !!token
        },
        logout() {
            localStorage.removeItem('token')
            sessionStorage.removeItem('token')
            this.user = null
            this.isAuthenticated = false
            this.friends = []
            this.friendRequests = []

            // Disconnect WebSocket
            console.log('🔌 Disconnecting WebSocket...')
            socketService.disconnect()

            // Force reload to clear any other state or redirect
            window.location.href = '/login'
        },
        updateBalance(currency: string, newAmount: number) {
            if (this.user && this.user.balances) {
                const key = currency.toLowerCase();
                if (this.user.balances[key] !== undefined) {
                    this.user.balances[key] = newAmount;
                }
            }
        }
    }
})
