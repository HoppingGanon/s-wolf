<script setup lang="ts">
import { toRefs } from 'vue'
import { watch } from 'vue'
import { RouteLocationNormalizedLoaded, useRoute } from 'vue-router'
import api from './plugins/api'
import store from './plugins/store'
import { onMounted } from 'vue'
import router from './plugins/router'
import { toast } from 'vue3-toastify'
import 'vue3-toastify/dist/index.css'

const route = useRoute()

function toastLogout() {
  toast.error('ログイン有効時間を超過したため、ログアウトしました')
  store.code = ''
  store.token = ''
  setTimeout(() => {
    api.setHeader()
    if (!route.meta.isUnauth) {
      router.push('/login')
    }
  }, 500)
}

const checkToken = async (route: RouteLocationNormalizedLoaded) => {
  if (store.token) {
    if (store.token.includes('.')) {
      const payload = atob(store.token.split('.')[1])
      const json = JSON.parse(payload)
      const exp = new Date((json?.exp || 0) * 1000)
      if (exp.getTime() < new Date().getTime()) {
        // 現在時刻が期限を上回った場合
        toastLogout()
      }
      return
    }

    try {
      await api.getLoginCheck()
    } catch (err: any) {
      if (err.response?.status === 401) {
        toastLogout()
      }
    }
  } else {
    if (!route.meta.isUnauth) {
      if (!route.meta.noToast) {
        toast.error('ログイントークンがありません')
      }
      router.push('/login')
    }
  }
}

const ready = async () => {
  await router.isReady()

  const { fullPath } = toRefs(route)
  await checkToken(route)
  watch(fullPath, (from) => {
    if (from !== '/login') {
      checkToken(route)
    }
  })
}

onMounted(() => {
  api.getHealth()
  ready()
})
</script>

<template>
  <v-app style="background: #120712">
    <v-main>
      <router-view :key="$route.fullPath" />
    </v-main>
  </v-app>
</template>

<style scoped></style>
