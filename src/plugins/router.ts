import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../views/Home.vue'),
  },
  {
    path: '/login',
    meta: {
      isUnauth: true,
    },
    component: () => import('../views/Login.vue'),
  },
  {
    path: '/resist/mailaddress',
    meta: {
      isUnauth: true,
    },
    component: () => import('../views/ResistMail.vue'),
  },
  {
    path: '/resist/temp/:code',
    meta: {
      isUnauth: true,
    },
    component: () => import('../views/User.vue'),
  },
  {
    path: '/new-game',
    component: () => import('../views/NewGame.vue'),
  },
  {
    path: '/join-game',
    component: () => import('../views/Join.vue'),
  },
  {
    path: '/games/:name',
    component: () => import('../views/Game.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
