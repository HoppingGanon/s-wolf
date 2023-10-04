<script setup lang="ts">
import { ref } from 'vue'
import DefaultCard from '../components/DefaultCard.vue'
import { emailRules } from '../../shared/rules'
import api from '../plugins/api'
import 'vue3-toastify/dist/index.css'

const address = ref('')
const form = ref()
const sent = ref(false)

const loading = ref(false)

const submit = async () => {
  if (form.value) {
    const result = await form.value.validate()
    if (result.valid) {
      loading.value = true
      api
        .postTempUser(address.value)
        .then(() => {
          sent.value = true
        })
        .catch(() => {})
        .finally(() => {
          loading.value = false
        })
    }
  }
}
</script>

<template>
  <default-card title="新規登録">
    <v-form v-if="!sent" ref="form">
      <v-row dense>
        <v-col>
          <v-text-field
            v-model="address"
            :rules="emailRules"
            label="登録するメールアドレスを入力してください"></v-text-field>
        </v-col>
      </v-row>
      <v-row dense>
        <v-col class="d-flex justify-end">
          <v-btn :disabled="loading" color="primary" @click="submit">
            ログイン
          </v-btn>
        </v-col>
      </v-row>
    </v-form>
    <div v-else class="py-5">
      以下のメールアドレスあてに登録コードを送信しました<br />
      メールアドレス: <b>{{ address }}</b> <br />
      <br />
      メールをご確認の上、メール本文に記載されたリンクを開いていただくと登録画面に進みます
    </div>
  </default-card>
</template>
