<script setup lang="ts">
const props = defineProps<{
  title?: string
  color?: string
  noDivider?: boolean
}>()
</script>

<template>
  <v-container>
    <v-row class="d-flex justify-center">
      <v-col cols="12" sm="10" md="8" lg="6" xl="4">
        <v-card>
          <v-toolbar v-if="props.title" :color="color || 'white'">
            <div
              class="px-3 text-center font-weight-bold text-h5"
              style="width: 100%">
              {{ props.title }}
            </div>
          </v-toolbar>

          <div v-if="!noDivider" class="pa-3">
            <v-divider></v-divider>
            <slot></slot>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
