<script setup lang="ts">
import DefaultCard from '../components/DefaultCard.vue'
import BigBtn from '../components/BigBtn.vue'
import router from '../plugins/router'
import store from '../plugins/store'

const openGame = () => {
  router.push('/new-game')
}

const logout = () => {
  store.code = ''
  store.token = ''
  router.push('/login')
}
</script>

<template>
  <default-card title="ホーム" style="margin-top: 100px" showLogo>
    <big-btn
      class="my-3 py-5"
      color="primary"
      font-color="white"
      @click="openGame">
      <template v-slot:preIcon> mdi-book-plus </template>
      ゲームを開く
    </big-btn>
    <big-btn
      class="my-3 py-5"
      color="purple-darken-4"
      font-color="white"
      to="/join-game">
      <template v-slot:preIcon> mdi-book-arrow-left </template>
      ゲームに参加する
    </big-btn>
    <big-btn
      class="my-3 py-5"
      color="blue-darken-4"
      font-color="white"
      to="/history">
      <template v-slot:preIcon> mdi-book-multiple </template>
      過去の結果を見る
    </big-btn>
    <div class="pt-2 d-flex justify-end">
      <v-btn color="grey" to="/update/mailaddress">
        <v-icon>mdi-cog</v-icon>
        ユーザー情報とメールアドレスを変更する
      </v-btn>
    </div>
    <div class="pb-5 pt-1 d-flex justify-end">
      <v-dialog>
        <template #activator="{ props }">
          <v-btn color="grey" v-bind="props">
            <v-icon>mdi-logout</v-icon>
            ログアウト
          </v-btn>
        </template>
        <template v-slot:default="{ isActive }">
          <div class="d-flex justify-center">
            <v-card class="pa-3" width="400px">
              <div class="pb-5">ログアウトしますか？</div>
              <div class="pt-5 d-flex justify-end">
                <v-btn class="ma-1" color="red" @click="logout">
                  ログアウト
                </v-btn>
                <v-btn class="ma-1" color="grey" @click="isActive.value = false"
                  >キャンセル</v-btn
                >
              </div>
            </v-card>
          </div>
        </template>
      </v-dialog>
    </div>
  </default-card>
</template>

<style>
aa {
  color: #0715b4;
}
</style>
