<script setup lang="ts">
import DefaultCard from '../components/DefaultCard.vue'
</script>

<template>
  <default-card title="ログイン">
    <v-row>
      <v-col>
        <v-text-field label="ユーザーID"></v-text-field>
      </v-col>
    </v-row>
    <v-row dense>
      <v-col>
        <v-text-field label="パスワード"></v-text-field>
      </v-col>
    </v-row>
    <v-row dense>
      <v-col class="text-right">
        <v-btn flat to="/resist/mailaddress"> <u>新規登録はこちら</u> </v-btn>
      </v-col>
    </v-row>
    <v-row dense>
      <v-col class="d-flex justify-end">
        <v-btn color="primary"> ログイン </v-btn>
      </v-col>
    </v-row>
  </default-card>
</template>
