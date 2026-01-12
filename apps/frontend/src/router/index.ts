import { createRouter, createWebHashHistory } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import MainLayout from '../components/MainLayout.vue';

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/Register.vue'),
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../views/ForgotPassword.vue'),
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('../views/ResetPassword.vue'),
    },
    {
      path: '/api/auth/github/callback',
      name: 'auth-callback',
      component: () => import('../views/AuthCallback.vue'),
    },
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          redirect: '/home',
        },
        {
          path: 'home',
          name: 'home',
          component: () => import('../views/Home.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'library',
          name: 'library',
          component: () => import('../views/Library.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'marketplace',
          name: 'marketplace',
          component: () => import('../views/Marketplace.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'store',
          name: 'store',
          component: () => import('../views/Store.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'social',
          name: 'social',
          component: () => import('../views/Social.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('../views/Profile.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'profile/:userId',
          name: 'user-profile',
          component: () => import('../views/UserProfile.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'chat/:friendId',
          name: 'chat',
          component: () => import('../views/Chat.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'admin',
          name: 'admin',
          component: () => import('../views/Admin.vue'),
          meta: { requiresAuth: true, requiresAdmin: true },
        },
        {
          path: 'games/details/:id',
          name: 'game-details',
          component: () => import('../views/GameDetails.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'terms',
          name: 'terms',
          component: () => import('../views/Terms.vue'),
        },
        {
          path: 'privacy',
          name: 'privacy',
          component: () => import('../views/Privacy.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../views/Settings.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'wallet',
          name: 'wallet',
          component: () => import('../views/Wallet.vue'),
          meta: { requiresAuth: true },
        },
      ],
    },
  ],
});

router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore();

  // Check if we have a token but not authenticated yet
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token && !userStore.isAuthenticated) {
    // Token exists, try to fetch profile
    try {
      await userStore.fetchProfile();
    } catch (e) {
      // Token is invalid, clear it
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
    }
  }

  // If going to login/register, check auth state
  if (to.path === '/login' || to.path === '/register') {
    if (userStore.isAuthenticated) {
      next('/home');
    } else {
      next();
    }
    return;
  }

  if (to.meta.requiresAuth && !userStore.isAuthenticated) {
    next('/login');
  } else if (to.meta.requiresAdmin && !userStore.user?.isAdmin) {
    // Redirect non-admin users trying to access admin page
    next('/home');
  } else {
    next();
  }
});

export default router;
