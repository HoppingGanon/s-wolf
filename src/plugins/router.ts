import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    meta: {
      noToast: true,
    },
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
    path: '/regist/mailaddress',
    name: 'MailCreate',
    meta: {
      isUnauth: true,
    },
    component: () => import('../views/ResistMail.vue'),
  },
  {
    path: '/update/mailaddress',
    name: 'MailUpdate',
    meta: {
      isUnauth: true,
    },
    component: () => import('../views/ResistMail.vue'),
  },
  {
    path: '/regist/temp/:code',
    name: 'UserCreate',
    meta: {
      isUnauth: true,
    },
    component: () => import('../views/User.vue'),
  },
  {
    path: '/update/temp/:code',
    name: 'UserUpdate',
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
  {
    path: '/history',
    component: () => import('../views/History.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
