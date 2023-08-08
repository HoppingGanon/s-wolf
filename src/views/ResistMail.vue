<script setup lang="ts">
import { ref } from 'vue'
import DefaultCard from '../components/DefaultCard.vue'
import { emailRules } from '../../shared/rules'

const address = ref('')
const form = ref()

const submit = async () => {
  if (form.value) {
    const result = await form.value.validate()
    if (result.valid) {
    }
  }
}
</script>

<template>
  <default-card title="新規登録">
    <v-form ref="form">
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
          <v-btn color="primary" @click="submit"> ログイン </v-btn>
        </v-col>
      </v-row>
    </v-form>
  </default-card>
</template>
