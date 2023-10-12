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

  actionMessage: '',

  result: {
    killedUsers: [],
  },
})
const password = ref('')

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
      .getGame(route.params.name, { hideToast: true })
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

const closeDialog = ref(false)
const close = async () => {
  api
    .deleteCancelGame(gameName.value)
    .then(() => {})
    .catch(() => {})
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
        .filter((u) => u.code !== store.code)
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
        await api.putVote(gameName.value, votedUser.value || '')
        await checkGame()
      } catch (err: any) {
        toast.error(err.response?.data?.message)
      }
    }
  }
}

const next = async () => {
  await api.putNext(gameName.value)
}
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
        <v-col class="d-flex justify-end">
          <v-btn to="/join-game"> キャンセル </v-btn>
          <v-btn color="primary" class="ml-1" @click="join"> 参加 </v-btn>
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
      <v-row class="py-3">
        <v-col class="d-flex justify-end">
          <v-btn v-if="!inputed" @click="input" color="primary" class="ml-1">
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
  </default-card>

  <v-form ref="judgeForm">
    <default-card
      v-if="state === 'JUDGEMENT'"
      :title="game.decisiveUsers.length > 0 ? '決戦投票' : '投票'"
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
      <v-row class="py-3">
        <v-col class="d-flex justify-end">
          <v-btn v-if="!inputed" color="primary" @click="judge"> 投票 </v-btn>
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
    <v-row class="py-3">
      <v-col class="d-flex justify-end">
        <v-btn v-if="!inputed" color="primary" @click="next"> 次へ </v-btn>
      </v-col>
    </v-row>
  </default-card>

  <default-card
    v-if="state === 'RESULT'"
    title="ゲーム結果"
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
      <v-col> 殺害された人↓ </v-col>
    </v-row>
    <v-row>
      <v-col>
        <table>
          <tr>
            <td>名前</td>
            <td>秘密のワード</td>
          </tr>
          <tr v-for="(u, i) of game.result.killedUsers" :key="i">
            <td>
              {{ u.name }}
            </td>
            <td>
              {{ u.fetishism }}
            </td>
            <td>
              {{ u.isWolf ? '人狼' : '市民' }}
            </td>
          </tr>
        </table>
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
        <v-btn color="primary" @click="close" dark> 強制終了 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
