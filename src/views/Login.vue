<script setup lang="ts">
import { ref } from 'vue'
import DefaultCard from '../components/DefaultCard.vue'
import api from '../plugins/api'
import { requiredRule, passwordRule, emailRules } from '../../shared/rules'
import router from '../plugins/router'
import store from '../plugins/store'
import 'vue3-toastify/dist/index.css'

const form = ref()
const mail = ref('')
const password = ref('')
const loading = ref(false)

const submit = async () => {
  if (form.value) {
    const result = await form.value.validate()
    if (result.valid) {
      api
        .getLogin(mail.value, password.value)
        .then((res) => {
          store.token = res.data.token
          store.code = res.data.code
          setTimeout(() => {
            api.setHeader()
            router.push('/')
          }, 500)
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
  <default-card title="ログイン" style="margin-top: 100px" showLogo>
    <v-form ref="form">
      <v-row>
        <v-col>
          <v-text-field
            label="メールアドレス"
            v-model="mail"
            name="mailaddress"
            :rules="emailRules"></v-text-field>
        </v-col>
      </v-row>
      <v-row dense>
        <v-col>
          <v-text-field
            label="パスワード"
            type="password"
            v-model="password"
            name="password"
            :rules="[requiredRule, passwordRule]"></v-text-field>
        </v-col>
      </v-row>
      <v-row dense>
        <v-col class="text-right">
          <v-btn flat to="/regist/mailaddress"> <u>新規登録はこちら</u> </v-btn>
        </v-col>
      </v-row>
      <v-row dense>
        <v-col class="d-flex justify-end">
          <v-btn color="primary" :disabled="loading" @click="submit">
            ログイン
          </v-btn>
        </v-col>
      </v-row>
    </v-form>
  </default-card>
</template>
