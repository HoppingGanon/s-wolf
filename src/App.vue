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

  if (route.path !== '/login') {
    checkToken(route)
  }

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
        <div class="d-flex justify-center py-5 pr-5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            version="1.1"
            width="256px"
            height="256px"
            viewBox="42 33 160 206"
            content='&lt;mxfile host="Electron" modified="2023-11-21T13:16:17.213Z" agent="5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) draw.io/13.9.9 Chrome/85.0.4183.121 Electron/10.1.5 Safari/537.36" etag="OfPsqaVHbu0GEXF3Epbx" version="13.9.9" type="device"&gt;&lt;diagram id="1h3_9xVDCxGZGYvFDEoG" name="ページ1"&gt;1VjRjqIwFP2aPmqgBYRHQGb3wUk2MZt9RulgM4U6WEfdr9+WtloUZ5zJmGENieXc25b2nnN7AaC02v9o8vXqkRWYAugUe4CmAEI39KD4k8hBIQFyFFA2pNBOJ2BO/mINGrctKfCm48gZo5ysu+CS1TVe8g6WNw3bdd2eGO3Ous5LfAHMlzm9RP+Qgq/0KpwT/BOTcsW7+CJfPpcN29Z6sprVWFmq3IyhXTervGA7C0IZQGnDGFetap9iKvfUbJfq93DNyvOX18Rjs1lIHicp/E2r2QgFaq7XnG71ukDmg8gB4RRkExBPQOKALABRCuIYZCGIxTWVPnEGIoEgECIQp20DgtgziGf2ocE1v+X53I926F2QGcZekNpNfjCRe8UNJyKQs3yB6S+2IZywWpgWjHNWAZQYh5iSUho4Wwt0xSsqblzRFKFZy8GqfSnJPV7kG7Icrxk9lHKkRLZSxpqi5ZifiMsZewjA1Bm7E+CLp0hbLJxcxZD3DuZFLeZDC3Og8gs+gUkuCMxxLcy/hDrLEJdaLSW13BBH3D4RSlNGWdPuNgoy18se1KYpPkunDW/Y81E4rnuETM9WGCjR0RQBwfurPHGP6hDZBrMK8+YgXHSHkedoRelMgzx9vzvpFprss7JEC03HXOeK8jj4iZeioan5EZrC4dJUUSNAVsxFfC4wX1HS823Mt/xu4MZD+/tObiB0xg14yQ23jxtH8Ou5gd7nBm9IXpfyLtmtCMfzdb6Upp2Ic5cDDeO5Js4oGqQ8YdQNAQwvQxD1RCC8WwC8wYpTHABtzrfPi0AJ1rHFGaizAdrnhY+svjeI05l6k9j9VnH6sMuM4NvFORlMvdRfz/VRN6BcRpeJcW0OBy9bZgyjTVtfx8IB+s56f7KKVqn/22EWBpgbRDzi4txLYGo+A5/nL7znXTnY5NMUyrV0lmJHcNOjqYoURZsD24IaF4aiNl/70iOVok2OlfjZtMoqhIebM4tckiUQWR8Iht7I9et0eqNygWepEfVULmGPAND9Kpdw2AqA0WCT91e/AJgKLLSr81Alfhtz1bzQfwe7+wvAp8+JN5j4X5X9ZrYhkvOeZX9v5K+9C9yPEQMs9pE/WEZAFWnfTiVIRbqTmS6RyOr4WTocs8Yd6XB+ukZ3pIO4PX26a23Wd1GU/QM=&lt;/diagram&gt;&lt;/mxfile&gt;'
            style="background-color: rgba(255, 255, 255, 0)">
            <defs />
            <g>
              <path
                d="M 118.9 144 L 220.1 144 L 220.1 178 L 220.1 178 L 132.7 214 L 24.6 182 L 24.6 182 L 24.6 182 L 102.8 112 L 135 112 L 118.9 144 Z"
                fill="#6e14ef"
                stroke="none"
                pointer-events="all" />
              <path
                d="M 144.6 171.9 L 104.3 171.9 L 164.1 148.5 L 161.5 171.9 Z"
                fill="#ffffff"
                stroke="none"
                pointer-events="all" />
              <path
                d="M 130 50 L 220 90 L 130 130 Z"
                fill="#6e14ef"
                stroke="none"
                transform="rotate(-90,175,90)"
                pointer-events="all" />
              <path
                d="M 112.2 104.1 L 148.6 33.9 L 157.7 61.2 L 136.9 104.1 Z"
                fill="#0d47a1"
                stroke="none"
                pointer-events="all" />
              <rect
                x="0"
                y="0"
                width="280"
                height="300"
                fill="none"
                stroke="none"
                pointer-events="all" />
              <g transform="translate(-0.5 -0.5)">
                <switch>
                  <foreignObject
                    style="overflow: visible; text-align: left"
                    pointer-events="none"
                    width="100%"
                    height="100%"
                    requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility">
                    <div
                      xmlns="http://www.w3.org/1999/xhtml"
                      style="
                        display: flex;
                        align-items: unsafe center;
                        justify-content: unsafe center;
                        width: 278px;
                        height: 1px;
                        padding-top: 150px;
                        margin-left: 1px;
                      ">
                      <div
                        style="
                          box-sizing: border-box;
                          font-size: 0;
                          text-align: center;
                        ">
                        <div
                          style="
                            display: inline-block;
                            font-size: 12px;
                            font-family: Helvetica;
                            color: #f0f0f0;
                            line-height: 1.2;
                            pointer-events: all;
                            white-space: normal;
                            word-wrap: normal;
                          ">
                          <font style="font-size: 250px">
                            <b>S</b>
                          </font>
                        </div>
                      </div>
                    </div>
                  </foreignObject>
                  <text
                    x="140"
                    y="154"
                    fill="#220052"
                    font-family="Helvetica"
                    font-size="12px"
                    text-anchor="middle">
                    S
                  </text>
                </switch>
              </g>
              <path
                d="M 118.9 144 L 220.1 144 L 220.1 178 L 220.1 178 L 151.1 206 L 130.4 166 L 49.9 160 L 49.9 160 L 102.8 112 L 135 112 L 118.9 144 Z"
                fill="#6e14ef"
                stroke="none"
                pointer-events="all" />
              <path
                d="M 144.6 171.9 L 104.3 171.9 L 164.1 148.5 L 161.5 171.9 Z"
                fill="#ffffff"
                stroke="none"
                pointer-events="all" />
              <path
                d="M 135.1 135.4 L 145.5 112 L 204 112 L 215.7 135.4 Z"
                fill="#6e14ef"
                stroke="none"
                pointer-events="all" />
            </g>
            <switch>
              <g
                requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" />
              <a
                transform="translate(0,-5)"
                xlink:href="https://desk.draw.io/support/solutions/articles/16000042487"
                target="_blank">
                <text text-anchor="middle" font-size="10px" x="50%" y="100%">
                  Viewer does not support full SVG 1.1
                </text>
              </a>
            </switch>
          </svg>
        </div>
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
