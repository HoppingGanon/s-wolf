<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DefaultCard from '../components/DefaultCard.vue'
import router from '../plugins/router'
import {
  requiredRule,
  passwordRule,
  memberCountRule,
  baseRule,
} from '../../shared/rules'
import api from '../plugins/api'
import { toast } from 'vue3-toastify'
import 'vue3-toastify/dist/index.css'

onMounted(() => {
  api
    .getMyGame()
    .then((res) => {
      if (res.data.exists) {
        toast.info('既に作成済みのゲームがあったため、移動しました')
        router.push(`/games/${res.data.gameName}`)
      }
    })
    .catch((err) => {
      toast.error(err.response?.data?.message)
    })
})

const title = ref('')
const password = ref('')
const memberCount = ref(4)
const finnalyReleasing = ref(false)
const form = ref()

const memberCountItems: number[] = []
for (let i = 3; i <= 16; i++) {
  memberCountItems.push(i)
}

const submit = async () => {
  if (form.value) {
    const result = await form.value.validate()
    if (result.valid) {
      api
        .postGame(
          title.value,
          password.value,
          memberCount.value,
          finnalyReleasing.value
        )
        .then((res) => {
          router.push(`/games/${res.data.gameName}`)
        })
        .catch((res) => {
          console.log(res.response.data)
        })
    }
  }
}
</script>

<template>
  <default-card title="ゲームを開く" style="margin-top: 100px">
    <v-form ref="form">
      <v-row dense>
        <v-col>
          <v-text-field
            v-model="title"
            label="ゲームタイトル"
            :rules="[requiredRule, baseRule]" />
        </v-col>
      </v-row>
      <v-row dense>
        <v-col>
          <v-text-field
            v-model="password"
            label="あいことば"
            :rules="[requiredRule, passwordRule]" />
        </v-col>
      </v-row>
      <v-row dense>
        <v-col>
          <v-select
            label="参加人数"
            v-model="memberCount"
            :items="memberCountItems"
            :rules="[memberCountRule]" />
        </v-col>
      </v-row>
      <v-row dense>
        <v-col>
          <v-checkbox
            label="ゲーム終了後に勝者のカードを公開する"
            v-model="finnalyReleasing" />
        </v-col>
      </v-row>
      <v-row>
        <v-col class="d-flex justify-end">
          <v-btn color="primary" @click="submit">ゲーム作成</v-btn>
        </v-col>
      </v-row>
    </v-form>
  </default-card>
</template>
