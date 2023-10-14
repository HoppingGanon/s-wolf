<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import DefaultCard from '../components/DefaultCard.vue'
import { requiredRule, passwordRule, baseRule } from '../../shared/rules'
import router from '../plugins/router'
import store from '../plugins/store'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import api from '../plugins/api'
import { ActionType, GetGameResponse } from '../../prisma/apimodel'
import { toast } from 'vue3-toastify'
import 'vue3-toastify/dist/index.css'
import axios from 'axios'
import { watch } from 'vue'
import ResultTable from '../components/ResultTable.vue'

const route = useRoute()

const passForm = ref()
const judgeForm = ref()
const gameName = ref('')
const word = ref('')
const timer = ref(0)
const timerStr = computed(
  () =>
    `${('00' + Math.floor(timer.value / 60)).slice(-2)}:${(
      '00' +
      (timer.value % 60)
    ).slice(-2)}`
)

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
  actionTimeLimit: 0,
  wolfFetishism: '',

  decisiveUsers: [],

  actionTitle: '',
  actionMessage: '',

  result: {
    users: [],
  },
})
const password = ref('')

const isDecisive = computed(() => game.value.decisiveUsers.length)
const isDecisivePopup = ref(false)

const checkGame = async () => {
  try {
    const res = await api.getGame(gameName.value)
    if (!res.data.opened) {
      clearInterval(job.value)
      toast.error(res.data.message)
      router.push('/')
      return
    }

    // 2秒以上乖離したらタイマー同期
    timer.value =
      Math.abs(timer.value - res.data.actionTimeLimit) >= 2
        ? res.data.actionTimeLimit
        : timer.value

    game.value = res.data
    state.value = game.value.currentAction || 'READY'

    if (state.value === 'JUDGEMENT' && isDecisive.value) {
      if (!showPopup.value && !isDecisivePopup.value) {
        popup()
      }
      isDecisivePopup.value = true
    } else {
      isDecisivePopup.value = false
    }
  } catch (err: any) {
    toast.error(err.response?.data?.message)
    return
  }
}

const job = ref(
  setInterval(async () => {
    if (
      ['READY', 'INPUT', 'DISCUSSION', 'JUDGEMENT', 'EXECUTION'].includes(
        state.value
      )
    ) {
      await checkGame()
    }
  }, 2000)
)
const jobSec = ref(
  setInterval(async () => {
    if (timer.value > 0) {
      timer.value--
    } else {
      timer.value = 0
    }
  }, 1000)
)
onBeforeRouteLeave(() => {
  // ページを離れる際に定期実行処理を削除
  clearInterval(job.value)
  clearInterval(jobSec.value)
})

onMounted(async () => {
  gameName.value =
    typeof route.params.name === 'string' ? route.params.name : ''

  try {
    const res = await api.getMyGame()
    if (res.data.exists && res.data.gameName !== route.params.name) {
      toast.info('参加中のゲームがあったため、移動しました')
      router.push(`/games/${res.data.gameName}`)
      return
    }
  } catch (err: any) {
    toast.error(err.response?.data?.message)
    return
  }

  if (typeof route.params.name === 'string') {
    await api
      .getGame(route.params.name, { hideToast: true })
      .then((res) => {
        if (res.data.currentAction !== 'RESULT' && !res.data.opened) {
          toast.error(res.data.message)
          router.push('/')
          return
        }
        game.value = res.data
        state.value = game.value.currentAction || 'READY'
      })
      .catch((err) => {
        if (err.response?.status === 404) {
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
        disabled.value = true
        await api.postJoinGame(gameName.value, password.value)
        await checkGame()
      } catch (err: any) {
        toast.error(err.response?.data?.message)
        router.push(`/join-game`)
      } finally {
        disabled.value = false
      }
    }
  }
}

const closeDialog = ref(false)
const close = async () => {
  disabled.value = true
  api
    .deleteCancelGame(gameName.value)
    .then(async () => {
      await checkGame()
    })
    .catch(() => {})
    .finally(() => {
      disabled.value = false
    })
}

const start = async () => {
  try {
    disabled.value = true
    await api.postStartAction(gameName.value)
    await checkGame()
  } catch (err: any) {
    toast.error(err.response?.data?.message)
  } finally {
    disabled.value = false
  }
}

const input = async () => {
  try {
    disabled.value = true
    await api.putInputWord(gameName.value, word.value)
    await checkGame()
  } catch (err: any) {
    toast.error(err.response?.data?.message)
  } finally {
    disabled.value = false
  }
}

// INPUTとJUDGEMENTで使用
const inputed = computed(() =>
  game.value.userActions
    ? game.value.userActions.filter(
        (ua) => ua.code === store.code && ua.completed
      ).length !== 0
    : false
)

const voteItemes = computed(() => {
  if (game.value.decisiveUsers.length === 0) {
    if (game.value.users) {
      return game.value.users
        .filter((u) => u.code !== store.code && !u.isDied)
        .map((u) => {
          return { title: u.name, value: u.code }
        })
    } else {
      return []
    }
  } else {
    return game.value.decisiveUsers
      .filter((u) => u.code !== store.code)
      .map((u) => {
        return { title: u.name, value: u.code }
      })
  }
})

const votedUser = ref<string | undefined>(undefined)
const judge = async () => {
  if (judgeForm.value) {
    const result = await judgeForm.value.validate()
    if (result.valid) {
      try {
        disabled.value = true
        await api.putVote(gameName.value, votedUser.value || '')
        await checkGame()
      } catch (err: any) {
        toast.error(err.response?.data?.message)
      } finally {
        disabled.value = false
        votedUser.value = undefined
      }
    }
  }
}

const next = async () => {
  try {
    disabled.value = true
    await api.putNext(gameName.value)
    await checkGame()
  } catch (err: any) {
    toast.error(err.response?.data?.message)
    router.push(`/join-game`)
  } finally {
    disabled.value = false
  }
}
type Dictionary = { [key: string]: any }

const popupImageUrls = [
  'INPUT',
  'DISCUSSION',
  'JUDGEMENT-D',
  'JUDGEMENT',
  'EXECUTION',
  'RESULT-WOLF',
  'RESULT-HUMAN',
]
const popupImages = ref<Dictionary>({})
const popupImage = computed(() => {
  let image: string = state.value

  if (state.value === 'JUDGEMENT') {
    if (game.value.decisiveUsers.length === 0) {
      image = 'JUDGEMENT'
    } else {
      image = 'JUDGEMENT-D'
    }
  } else if (state.value === 'RESULT') {
    if (game.value.result.winner === 'wolf') {
      image = 'RESULT-WOLF'
    } else {
      image = 'RESULT-HUMAN'
    }
  }
  return popupImages.value[image]
})

popupImageUrls.forEach((url) => {
  axios
    .get(`/images/${url}.png`, { baseURL: '', responseType: 'blob' })
    .then((res) => {
      const fr = new FileReader()
      fr.readAsDataURL(res.data)
      fr.onload = () => {
        popupImages.value[url] = fr.result
      }
    })
})

const showPopup = ref(false)
const popupClass = ref('popup-none')
const popup = () => {
  popupClass.value = 'popup-none'
  showPopup.value = true
  nextTick(() => {
    popupClass.value = 'popup-in'
    setTimeout(() => {
      popupClass.value = 'popup-show'
      setTimeout(() => {
        popupClass.value = 'popup-out'
        setTimeout(() => {
          popupClass.value = 'popup-none'
          showPopup.value = false
        }, 500)
      }, 3500)
    }, 500)
  })
}
watch(state, (_, oldVal) => {
  if (
    !showPopup.value &&
    ['READY', 'INPUT', 'DISCUSSION', 'JUDGEMENT', 'EXECUTION'].includes(oldVal)
  ) {
    popup()
  }
})

const disabled = ref(false)

const resultUsers = computed(() => {
  const list: {
    code: string
    name: string
    fetishism?: string
    isWolf?: boolean
    isDied: boolean
  }[] = []

  if (game.value.users) {
    game.value.users.forEach((u) => {
      list.push({
        code: u.code,
        name: u.name,
        fetishism: undefined,
        isWolf: undefined,
        isDied: u.isDied,
      })
    })
  }
  game.value.result.users.forEach((u) => {
    const hits = list.filter((u2) => u2.code === u.code)
    if (hits.length > 0) {
      hits[0].fetishism = u.fetishism
      hits[0].isWolf = u.isWolf
    }
  })

  return list.sort((a, b) => (a.code < b.code ? -1 : 1))
})
</script>

<template>
  <div v-show="showPopup" class="popup-wrapper">
    <div class="popup-wrapper-2 d-flex justify-center align-center">
      <v-card class="popup pa-1" color="#FFF7DF" :class="popupClass">
        <div class="text-center font-weight-bold text-h5 pb-3">
          {{ game.actionTitle }}
        </div>
        <div class="text-center text-h6 pb-5">{{ game.actionMessage }}</div>
        <div class="px-5 pb-5">
          <v-img :src="popupImage"></v-img>
        </div>
      </v-card>
    </div>
  </div>

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
        <v-col class="d-flex justify-end">
          <v-btn to="/join-game"> キャンセル </v-btn>
          <v-btn
            color="primary"
            class="ml-1"
            @click="join"
            :disabled="disabled">
            参加
          </v-btn>
        </v-col>
      </v-row>
    </v-form>
  </default-card>

  <default-card
    v-else-if="state === 'READY'"
    title="参加者を募っています"
    :show-close="game.hostUser?.code === store.code"
    @close="closeDialog = true"
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
        残り時間: <b>{{ timerStr }}</b>
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
    <v-row
      v-if="
        !(
          game.users !== undefined &&
          game.users.length >= 3 &&
          game.hostUser?.code === store.code
        )
      ">
      <v-col>
        <div>
          <span> ※3人以上集まればホストの操作で開始できます </span>
        </div>
      </v-col>
    </v-row>
    <v-row>
      <v-col class="d-flex justify-end">
        <v-btn
          v-if="
            game.users !== undefined &&
            game.users.length >= 3 &&
            game.hostUser?.code === store.code
          "
          color="primary"
          @click="start"
          :disabled="disabled"
          class="ml-1">
          開始
        </v-btn>
      </v-col>
    </v-row>
  </default-card>

  <default-card
    v-if="state === 'INPUT'"
    title="狼ワードの入力"
    :show-close="game.hostUser?.code === store.code"
    @close="closeDialog = true"
    style="margin-top: 100px">
    <v-form ref="passForm">
      <v-row>
        <v-col>
          タイトル: <b>{{ game.title }}</b>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          ゲームID: <b>{{ game.name }}</b>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          残り時間: <b>{{ timerStr }}</b>
        </v-col>
      </v-row>
      <v-row>
        <v-col v-if="inputed"> 他参加者の入力完了をお待ちください </v-col>
        <v-col v-else>
          タイトルに沿った貴方の秘密のワードを入力してください
        </v-col>
      </v-row>
      <v-row v-if="inputed" class="py-3">
        <v-col>
          <v-progress-linear indeterminate color="primary" />
        </v-col>
      </v-row>
      <v-row v-if="!inputed">
        <v-col>
          <v-text-field
            label="秘密のワード"
            v-model="word"
            :rules="[requiredRule, baseRule]"></v-text-field>
        </v-col>
      </v-row>
      <v-row>
        <v-col> ＜参加者＞ </v-col>
      </v-row>
      <v-row dense>
        <v-col>
          <result-table :resultUsers="resultUsers"></result-table>
        </v-col>
      </v-row>
      <v-row class="py-3">
        <v-col class="d-flex justify-end">
          <v-btn
            v-if="!inputed"
            @click="input"
            color="primary"
            class="ml-1"
            :disabled="disabled">
            送信
          </v-btn>
        </v-col>
      </v-row>
    </v-form>
  </default-card>

  <default-card
    v-if="state === 'DISCUSSION'"
    title="議論タイム"
    :show-close="game.hostUser?.code === store.code"
    @close="closeDialog = true"
    style="margin-top: 100px">
    <v-row>
      <v-col>
        タイトル: <b>{{ game.title }}</b>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        ゲームID: <b>{{ game.name }}</b>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        残り時間: <b>{{ timerStr }}</b>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        狼ワード: <b>{{ game.wolfFetishism }}</b>
      </v-col>
    </v-row>
    <v-row class="py-3">
      <v-col class="d-flex justify-center">
        <v-progress-circular
          :model-value="(100 * timer) / (game.discussionSeconds || 1)"
          color="primary"
          :size="100"
          :width="15" />
      </v-col>
    </v-row>
    <v-row>
      <v-col> ＜参加者＞ </v-col>
    </v-row>
    <v-row dense>
      <v-col>
        <result-table :resultUsers="resultUsers"></result-table>
      </v-col>
    </v-row>
  </default-card>

  <v-form ref="judgeForm">
    <default-card
      v-if="state === 'JUDGEMENT'"
      :title="isDecisive ? '決戦投票' : '投票'"
      :show-close="game.hostUser?.code === store.code"
      @close="closeDialog = true"
      style="margin-top: 100px">
      <v-row>
        <v-col>
          タイトル: <b>{{ game.title }}</b>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          ゲームID: <b>{{ game.name }}</b>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          残り時間: <b>{{ timerStr }}</b>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          狼ワード: <b>{{ game.wolfFetishism }}</b>
        </v-col>
      </v-row>
      <v-row>
        <v-col v-if="inputed"> 他参加者の投票完了をお待ちください </v-col>
        <v-col v-else> 狼ワードを指定したと思う人に投票してください </v-col>
      </v-row>
      <v-row v-if="!inputed">
        <v-col>
          <v-select v-model="votedUser" required :items="voteItemes" />
        </v-col>
      </v-row>
      <v-row>
        <v-col> ＜参加者＞ </v-col>
      </v-row>
      <v-row dense>
        <v-col>
          <result-table :resultUsers="resultUsers"></result-table>
        </v-col>
      </v-row>
      <v-row class="py-3">
        <v-col class="d-flex justify-end">
          <v-btn
            v-if="!inputed"
            color="primary"
            @click="judge"
            :disabled="disabled">
            投票
          </v-btn>
        </v-col>
      </v-row>
    </default-card>
  </v-form>

  <default-card
    v-if="state === 'EXECUTION'"
    title="投票結果"
    :show-close="game.hostUser?.code === store.code"
    @close="closeDialog = true"
    style="margin-top: 100px">
    <v-row>
      <v-col>
        タイトル: <b>{{ game.title }}</b>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        ゲームID: <b>{{ game.name }}</b>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        残り時間: <b>{{ timerStr }}</b>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        狼ワード: <b>{{ game.wolfFetishism }}</b>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        殺害されたのは<b>{{ game.killedUser?.name }}</b> さんでした<br />
        死者のワードは公開されます。<br />
        <br />
        {{ game.killedUser?.name }} さんのワードは<b>{{
          game.killedUser?.fetishism
        }}</b
        >でした
      </v-col>
    </v-row>
    <v-row>
      <v-col> ＜参加者＞ </v-col>
    </v-row>
    <v-row dense>
      <v-col>
        <result-table :resultUsers="resultUsers"></result-table>
      </v-col>
    </v-row>
    <v-row class="py-3">
      <v-col class="d-flex justify-end">
        <v-btn
          v-if="!inputed"
          color="primary"
          @click="next"
          :disabled="disabled">
          次へ
        </v-btn>
        <div v-else>他参加者の確認が完了するのをお待ちください。</div>
      </v-col>
    </v-row>
  </default-card>

  <default-card
    v-if="state === 'RESULT'"
    title="ゲーム結果"
    style="margin-top: 100px">
    <v-row>
      <v-col>
        タイトル: <b>{{ game.title }}</b>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        ゲームID: <b>{{ game.name }}</b>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        狼ワード: <b>{{ game.wolfFetishism }}</b>
      </v-col>
    </v-row>
    <v-row>
      <v-col class="text-title font-weight-bold">
        {{
          game.result.winner === 'wolf' ? '人狼' : '市民'
        }}の勝利でゲームは終了しました
      </v-col>
    </v-row>
    <v-row>
      <v-col> ＜結果＞ </v-col>
    </v-row>
    <v-row dense>
      <v-col>
        <result-table :resultUsers="resultUsers" is-result></result-table>
      </v-col>
    </v-row>
    <v-row class="py-3">
      <v-col class="d-flex justify-end">
        <v-btn color="primary" to="/"> ホームに戻る </v-btn>
      </v-col>
    </v-row>
  </default-card>

  <v-dialog v-model="closeDialog">
    <v-card>
      <v-card-title> 強制終了 </v-card-title>
      <v-card-text>
        ホストユーザーの権限でゲームを強制終了しますか？
      </v-card-text>
      <v-card-actions class="d-flex justify-end">
        <v-btn @click="closeDialog = false"> キャンセル </v-btn>
        <v-btn color="primary" @click="close" dark :disabled="disabled">
          強制終了
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.popup-wrapper {
  position: fixed;
  width: 100vw;
  height: 100vh;
  z-index: 100;
}
.popup-wrapper-2 {
  width: 100%;
  height: 100%;
}

.popup {
  width: 480px;
  min-height: 320px;
  transition-property: all;
  transition-duration: 0.5s;
}

.popup-none {
  opacity: 0;
  margin-left: 100px;
  margin-right: 0px;
}
.popup-in {
  opacity: 0;
  margin-left: 100px;
  margin-right: 0px;
}
.popup-show {
  opacity: 1;
  margin-left: 0px;
  margin-right: 0px;
}
.popup-out {
  opacity: 0;
  margin-left: 0px;
  margin-right: 100px;
}
</style>
