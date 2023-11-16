<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DefaultCard from '../components/DefaultCard.vue'
import api from '../plugins/api'
import store from '../plugins/store'
import { useRoute } from 'vue-router'
import { baseRule, requiredRule, passwordRule } from '../../shared/rules'
import router from '../plugins/router'
import 'vue3-toastify/dist/index.css'
import { toast } from 'vue3-toastify'

const form = ref()
const code = ref('')
const name = ref('')
const password = ref('')
const retype = ref('')
const loading = ref(false)

const route = useRoute()
onMounted(() => {
  code.value =
    typeof route.params.code === 'string'
      ? route.params.code
      : route.params.code.join('')

  if (route.name === 'UserUpdate') {
    api
      .getUser()
      .then((res) => {
        name.value = res.data.name
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message || err.message || 'エラーが発生しました'
        )
      })
  }
})

const submit = async () => {
  if (form.value) {
    const result = await form.value.validate()
    if (result.valid) {
      loading.value = true
      if (route.name === 'UserUpdate') {
        api
          .putUser(code.value, name.value, password.value, retype.value)
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
      } else if (route.name === 'UserCreate') {
        api
          .postUser(code.value, name.value, password.value, retype.value)
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
}
</script>

<template>
  <default-card
    :title="$route.name === 'UserCreate' ? 'ユーザー登録' : '登録情報変更'">
    <v-form ref="form">
      <v-row>
        <v-col>
          <v-text-field
            label="名前"
            v-model="name"
            :disabled="loading"
            :rules="[requiredRule, baseRule]"></v-text-field>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <v-text-field
            label="パスワード"
            v-model="password"
            :disabled="loading"
            type="password"
            :rules="[requiredRule, passwordRule]" />
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <v-text-field
            label="パスワード再入力"
            v-model="retype"
            :disabled="loading"
            type="password"
            :rules="[
              (v: string) => v === password || 'パスワードが一致しません',
            ]" />
        </v-col>
      </v-row>
      <v-row>
        <v-col class="d-flex justify-end">
          <v-btn color="primary" @click="submit" :disabled="loading">
            登録
          </v-btn>
        </v-col>
      </v-row>
    </v-form>
  </default-card>
</template>
