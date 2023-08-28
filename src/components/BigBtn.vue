<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'

defineProps<{
  color?: string
  fontColor?: string
}>()

const emits = defineEmits<{
  click: []
}>()

const display = useDisplay()
const size = computed(() => {
  switch (display.name.value) {
    case 'xs':
      return 60
    case 'sm':
      return 70
    case 'md':
      return 80
    case 'lg':
      return 90
    case 'xl':
      return 100
    default:
      return 110
  }
})
</script>

<template>
  <v-card class="btn" @click="emits('click')">
    <v-icon v-if="$slots.preIcon !== undefined" :size="size">
      <slot name="preIcon"></slot>
    </v-icon>
    <div class="content text-h5">
      <slot></slot>
    </div>
  </v-card>
</template>

<style scoped>
.btn {
  background-color: v-bind('color || "white"');
  color: v-bind('fontColor || "black"');
}
.content {
  display: inline;
}
</style>
