import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      manifest: {
        theme_color: '#8936FF',
        background_color: '#2EC6FE',
        orientation: 'any',
        display: 'standalone',
        lang: 'ja',
        name: 's-wolf',
        short_name: 's-wolf',
        start_url: 'https://s-wolf.onrender.com',
        scope: 'https://s-wolf.onrender.com/',
        description: 'みんなの秘密をかけて遊ぶ人狼ゲーム',

        icons: [
          {
            purpose: 'maskable',
            sizes: '512x512',
            src: '/images/pwa/icon512_maskable.png',
            type: 'image/png',
          },
          {
            purpose: 'any',
            sizes: '512x512',
            src: '/images/pwa/icon512_rounded.png',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  base: '/',
})
