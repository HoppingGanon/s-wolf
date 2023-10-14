<script setup lang="ts">
import { toast } from 'vue3-toastify'
import DefaultCard from '../components/DefaultCard.vue'
import api from '../plugins/api'
import { ref } from 'vue'
import { VDataTable } from 'vuetify/labs/VDataTable'
import { HistoryGameResponse } from '../../prisma/apimodel'

const history = ref<
  {
    name: string
    title: string
    hostName: string
    userCont: number
  }[]
>([])

const page = ref(1)
const loading = ref(true)
async function load() {
  await api
    .getHistory({
      page: page.value,
    })
    .then((res) => {
      const data = res.data.map((item: HistoryGameResponse) => {
        return {
          name: item.name,
          title: item.title,
          hostName:
            item.hostUser.name.length > 10
              ? `${item.hostUser.name.substring(0, 10)}...`
              : item.hostUser.name,
          userCont: item.users.length,
        }
      })

      if (data.length === 0) {
        loading.value = false
      } else {
        history.value = history.value.concat(data)
        page.value++
      }
    })
    .catch((err) => {
      toast.error(err.response?.data?.message)
    })
}
new Promise(async (resolve) => {
  while (loading.value) {
    await load()
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve('')
      }, 500)
    })
  }
  resolve('')
})

const headers = [
  { title: 'ゲームID', key: 'name' },
  { title: 'ゲームタイトル', key: 'title' },
  { title: 'ホスト', key: 'hostName' },
  { title: '人数', key: 'userCont' },
]
</script>

<template>
  <default-card title="過去の結果" style="margin-top: 100px">
    <v-card flat>
      <v-data-table
        :headers="headers"
        :items="history"
        item-value="name"
        class="elevation-1">
        <template #item.name="{ item }">
          <router-link :to="`/games/${item.columns.name}`">{{
            item.columns.name
          }}</router-link>
        </template>
        <template #item.title="{ item }"> {{ item.columns.title }} </template>
        <template #item.hostName="{ item }">
          {{ item.columns.hostName }}
        </template>
        <template #item.userCont="{ item }">
          {{ item.columns.userCont }}
        </template>
      </v-data-table>
    </v-card>
  </default-card>
</template>

<style scoped>
.row-fill {
  background-color: #e7f0ff;
}
</style>
