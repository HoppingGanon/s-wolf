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

const checkToken = async (route: RouteLocationNormalizedLoaded) => {
  if (store.token) {
    try {
      await api.getLoginCheck()
    } catch (err: any) {
      if (err.response?.status === 401) {
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
  ready()
})
</script>

<template>
  <v-app>
    <v-main>
      <router-view :key="$route.fullPath" />
    </v-main>
  </v-app>
</template>

<style scoped></style>
