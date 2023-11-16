<script setup lang="ts">
import { ref, toRefs } from 'vue'
import { watch } from 'vue'
import { RouteLocationNormalizedLoaded, useRoute } from 'vue-router'
import api from './plugins/api'
import store from './plugins/store'
import { onMounted } from 'vue'
import router from './plugins/router'
import { toast } from 'vue3-toastify'
import 'vue3-toastify/dist/index.css'

const route = useRoute()

const loading = ref(false)
const loadingDisp = ref(1)

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
        return
      }
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
  watch(fullPath, (from) => {
    if (from !== '/login') {
      checkToken(route)
    }
  })
}

const timer = ref(new Date())

onMounted(() => {
  loading.value = true
  api
    .getHealth()
    .then(() => {
      setTimeout(
        () => {
          loadingDisp.value = 0
          setTimeout(() => {
            loading.value = false
          }, 300)
        },
        Math.max(0, 1000 - (new Date().getTime() - timer.value.getTime()))
      )
    })
    .catch(() => {
      setTimeout(
        () => {
          loadingDisp.value = 0
          setTimeout(() => {
            loading.value = false
          }, 300)
        },
        Math.max(0, 1000 - (new Date().getTime() - timer.value.getTime()))
      )
    })
  ready()
})
</script>

<template>
  <v-app style="background: #120712">
    <div v-if="loading" class="splash d-flex justify-center align-center">
      <div>
        <div class="d-flex justify-center">
          <span class="font-weight-bold text-h3">s-wolf</span>
        </div>
        <div class="d-flex justify-center pt-5">
          <span class="font-weight-bold text-h5">loading...</span>
        </div>
      </div>
    </div>
    <v-main>
      <router-view :key="$route.fullPath" />
    </v-main>
  </v-app>
</template>

<style scoped>
.splash {
  position: fixed;
  width: 100%;
  height: 100%;
  z-index: 2500;
  transition-property: all;
  transition-duration: 300ms;
  opacity: v-bind(loadingDisp);
  background-color: #060006;
  color: white;
}
</style>
