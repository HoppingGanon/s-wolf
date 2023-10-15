<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DefaultCard from '../components/DefaultCard.vue'
import { emailRules } from '../../shared/rules'
import api from '../plugins/api'
import 'vue3-toastify/dist/index.css'
import { useRoute } from 'vue-router'
import { toast } from 'vue3-toastify'

const route = useRoute()

const address = ref('')
const form = ref()
const sent = ref(false)

const loading = ref(false)

onMounted(() => {
  if (route.name === 'MailUpdate') {
    loading.value = true
    api
      .getUser()
      .then((res) => {
        address.value = res.data.mailaddress
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message || err.message || 'エラーが発生しました'
        )
      })
      .finally(() => {
        loading.value = false
      })
  }
})

const submit = async () => {
  if (form.value) {
    const result = await form.value.validate()
    if (result.valid) {
      loading.value = true
      if (route.name === 'MailCreate') {
        api
          .postTempUser(address.value, 'regist')
          .then(() => {
            sent.value = true
          })
          .catch(() => {})
          .finally(() => {
            loading.value = false
          })
      } else {
        api
          .postTempUser(address.value, 'update')
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
}
</script>

<template>
  <default-card
    :title="$route.name === 'MailCreate' ? '新規登録' : 'メールアドレス変更'">
    <v-form v-if="!sent" ref="form">
      <v-row dense>
        <v-col>
          <v-text-field
            v-model="address"
            :rules="emailRules"
            :disabled="loading"
            :label="
              $route.name === 'MailCreate'
                ? '登録するメールアドレスを入力してください'
                : '変更したいメールアドレスを入力してください'
            "></v-text-field>
        </v-col>
      </v-row>
      <v-row dense>
        <v-col class="d-flex justify-end">
          <v-btn :disabled="loading" color="primary" @click="submit">
            登録
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
