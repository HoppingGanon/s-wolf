import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'welcome',
    component: () => import('../views/Login.vue'),
  },
  {
    path: '/resist/mailaddress',
    name: 'resist-mailaddress',
    component: () => import('../views/ResistMail.vue'),
  },
  {
    path: '/resist/code/:code',
    name: 'resist-code',
    component: () => import('../views/Login.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
