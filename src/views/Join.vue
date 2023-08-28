<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DefaultCard from '../components/DefaultCard.vue'
import { requiredRule, baseRule } from '../../shared/rules'
import router from '../plugins/router'
import api from '../plugins/api'
import { toast } from 'vue3-toastify'
import 'vue3-toastify/dist/index.css'

const form = ref()

const name = ref('')

onMounted(async () => {
  try {
    const res = await api.getMyGame()
    if (res.data.exists) {
      toast.info('開いたまま終了していないゲームがあったため、移動しました')
      router.push(`/games/${res.data.gameName}`)
      return
    }
  } catch (err: any) {
    toast.error(err.response?.data?.message)
    return
  }
})

const submit = async () => {
  if (form.value) {
    const result = await form.value.validate()
    if (result.valid) {
      router.push(`/games/${name.value}`)
    }
  }
}
</script>

<template>
  <default-card
    title="参加したい部屋のコードを入力してください"
    style="margin-top: 100px">
    <v-form ref="form">
      <v-row>
        <v-col>
          <v-text-field
            label="コード"
            v-model="name"
            :rules="[requiredRule, baseRule]"></v-text-field>
        </v-col>
      </v-row>
      <v-row>
        <v-col class="d-flex justify-end">
          <v-btn color="primary" @click="submit"> 参加する </v-btn>
        </v-col>
      </v-row>
    </v-form>
  </default-card>
</template>
