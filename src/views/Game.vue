<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DefaultCard from '../components/DefaultCard.vue'
import { requiredRule, passwordRule, baseRule } from '../../shared/rules'
import router from '../plugins/router'
import store from '../plugins/store'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import api from '../plugins/api'
import { ActionType, GetGameResponse } from '../../prisma/apimodel'
import { toast } from 'vue3-toastify'
import 'vue3-toastify/dist/index.css'

const route = useRoute()

const passForm = ref()
const gameName = ref('')
const word = ref('')

const state = ref<ActionType | 'UNAUTH' | 'LOADING' | 'INPUTED'>('LOADING')
const game = ref<GetGameResponse>({
  opened: false,
  message: '',

  name: '',
  title: '',
  hostUser: {
    code: '',
    name: '',
  },
  users: [],
  maxMembers: 3,

  userActions: [],
  currentAction: 'READY',
})
const password = ref('')

const checkGame = async () => {
  try {
    const res = await api.getGame(gameName.value)
    if (!res.data.opened) {
      toast.error(res.data.message)
      router.push('/')
      return
    }
    game.value = res.data
    state.value = game.value.currentAction || 'READY'
  } catch (err: any) {
    toast.error(err.response?.data?.message)
    return
  }
}

const job = ref(
  setInterval(async () => {
    if (['READY', 'INPUT'].includes(state.value)) {
      await checkGame()
    }
  }, 2000)
)
onBeforeRouteLeave(() => {
  // ページを離れる際に定期実行処理を削除
  clearInterval(job.value)
})

onMounted(async () => {
  gameName.value =
    typeof route.params.name === 'string' ? route.params.name : ''

  try {
    const res = await api.getMyGame()
    if (res.data.exists && res.data.gameName !== route.params.name) {
      toast.info('開いたまま終了していないゲームがあったため、移動しました')
      router.push(`/games/${res.data.gameName}`)
      return
    }
  } catch (err: any) {
    toast.error(err.response?.data?.message)
    return
  }

  if (typeof route.params.name === 'string') {
    await api
      .getGame(route.params.name)
      .then((res) => {
        if (!res.data.opened) {
          toast.error(res.data.message)
          router.push('/')
          return
        }
        game.value = res.data
        state.value = game.value.currentAction || 'READY'
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          toast.error(err.response.data.message)
          router.push('/join-game')
        } else {
          state.value = 'UNAUTH'
        }
      })
  } else {
    toast.error('URLが異常です')
    router.push('/')
  }
})

const join = async () => {
  if (passForm.value) {
    const result = await passForm.value.validate()
    if (result.valid) {
      try {
        await api.postJoinGame(gameName.value, password.value)
        await checkGame()
      } catch (err: any) {
        toast.error(err.response?.data?.message)
        router.push(`/join-game`)
      }
    }
  }
}

const start = async () => {
  try {
    await api.postStartAction(gameName.value)
    await checkGame()
  } catch (err: any) {
    toast.error(err.response?.data?.message)
  }
}

const input = async () => {
  try {
    await api.putInputWord(gameName.value, word.value)
    await checkGame()
  } catch (err: any) {
    toast.error(err.response?.data?.message)
  }
}

const inputed = computed(() =>
  game.value.userActions
    ? game.value.userActions.filter(
        (ua) => ua.code === store.code && ua.completed
      ).length !== 0
    : false
)
</script>

<template>
  <default-card
    v-if="state === 'UNAUTH'"
    title="合言葉を使って部屋に参加します"
    style="margin-top: 100px">
    <v-form ref="passForm">
      <v-row>
        <v-col>
          <v-text-field
            label="あいことば"
            type="password"
            v-model="password"
            name="password"
            :rules="[requiredRule, passwordRule]"></v-text-field>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <v-btn @click="join"> 参加 </v-btn>
        </v-col>
      </v-row>
    </v-form>
  </default-card>

  <default-card
    v-else-if="state === 'READY'"
    title="参加者を募っています"
    style="margin-top: 100px">
    <v-row>
      <v-col>
        <v-progress-linear indeterminate color="primary" />
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        ゲームID: <b>{{ game.name }}</b>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        ゲームに誘いたいユーザーにゲームIDとあいことばを共有して、ゲームを開始しましょう
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-divider />
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        現在の参加人数: {{ game.users?.length }}人 (最大{{ game.maxMembers }}人)
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-list>
          <v-list-item v-for="(u, i) of game.users" :key="i">
            ・ {{ u.name }}
            <span v-if="u.code === game.hostUser?.code">(ホスト)</span>
          </v-list-item>
        </v-list>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-btn
          v-if="
            game.users !== undefined &&
            game.users.length >= 3 &&
            game.hostUser?.code === store.code
          "
          @click="start">
          開始
        </v-btn>
        <span v-else> ※3人以上集まればホストの操作で開始できます </span>
      </v-col>
    </v-row>
  </default-card>

  <default-card
    v-if="state === 'INPUT'"
    title="狼ワードの入力"
    style="margin-top: 100px">
    <v-form ref="passForm">
      <v-row>
        <v-col>
          タイトル: <b>{{ game.title }}</b>
        </v-col>
      </v-row>
      <v-row>
        <v-col v-if="inputed"> 他参加者の入力完了をお待ちください </v-col>
        <v-col v-else> タイトルに沿って狼ワードを入力してください </v-col>
      </v-row>
      <v-row v-if="inputed" class="py-3">
        <v-col>
          <v-progress-linear indeterminate color="primary" />
        </v-col>
      </v-row>
      <v-row v-else>
        <v-col>
          <v-text-field
            label="狼ワード"
            v-model="word"
            :rules="[requiredRule, baseRule]"></v-text-field>
        </v-col>
      </v-row>
      <v-row class="py-3">
        <v-col> 残り時間 </v-col>
        <v-col v-if="!inputed" class="d-flex justify-end">
          <v-btn @click="input" color="primary"> 送信 </v-btn>
        </v-col>
      </v-row>
    </v-form>
  </default-card>
</template>
