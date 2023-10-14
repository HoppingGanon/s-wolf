<script setup lang="ts">
import DefaultCard from '../components/DefaultCard.vue'
import BigBtn from '../components/BigBtn.vue'
import router from '../plugins/router'

const openGame = () => {
  router.push('/new-game')
}
</script>

<template>
  <default-card title="s-wolf" style="margin-top: 100px">
    <big-btn
      class="my-3 py-5"
      color="#9080FF"
      font-color="white"
      @click="openGame">
      <template v-slot:preIcon> mdi-book-plus </template>
      ゲームを開く
    </big-btn>
    <big-btn
      class="my-3 py-5"
      color="#50C060"
      font-color="white"
      to="/join-game">
      <template v-slot:preIcon> mdi-book-arrow-left </template>
      ゲームに参加する
    </big-btn>
    <big-btn class="my-3 py-5" color="#FF9080" font-color="white" to="/history">
      <template v-slot:preIcon> mdi-book-plus </template>
      過去の結果を見る
    </big-btn>
  </default-card>
</template>
