import { createApp } from 'vue'
import App from './App.vue'
import router from './plugins/router'
import vuetify from './plugins/vuetify'
import Vue3Toastify, { type ToastContainerOptions } from 'vue3-toastify'

createApp(App)
  .use(vuetify)
  .use(router)
  .use(Vue3Toastify, {
    autoClose: 3000,
    clearOnUrlChange: false,
  } as ToastContainerOptions)
  .mount('#app')
