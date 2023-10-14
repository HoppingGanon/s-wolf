<script setup lang="ts">
defineProps<{
  resultUsers: {
    code: string
    name: string
    fetishism?: string
    isWolf?: boolean
    isDied: boolean
  }[]
  isResult?: boolean
}>()
</script>

<template>
  <table border="1" width="100%">
    <tr>
      <td class="px-1 text-center">名前</td>
      <td class="px-1 text-center">秘密のワード</td>
      <td v-if="isResult" class="px-1 text-center">役</td>
      <td class="px-1 text-center">生死</td>
    </tr>
    <tr v-for="(u, i) of resultUsers" :key="i">
      <td class="px-1 text-center">
        {{ u.name }}
      </td>
      <td class="px-1 text-center">
        {{ u.fetishism ? u.fetishism : '非公開' }}
      </td>
      <td
        v-if="isResult"
        class="px-1 text-center"
        :class="u.isWolf ? 'font-weight-bold' : ''">
        {{ u.isWolf === undefined ? '非公開' : u.isWolf ? '人狼' : '市民' }}
      </td>
      <td class="px-1 text-center" :class="u.isDied ? 'text-red' : ''">
        {{ u.isDied ? '死亡' : '生存' }}
      </td>
    </tr>
  </table>
</template>
