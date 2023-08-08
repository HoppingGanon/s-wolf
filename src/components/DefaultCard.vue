<script setup lang="ts">
const props = defineProps<{
  title?: string
}>()
</script>

<template>
  <v-container>
    <v-row class="d-flex justify-center">
      <v-col cols="12" sm="10" md="8" lg="6" xl="4">
        <v-card class="pa-3">
          <div v-if="props.title">
            <v-row>
              <v-col class="text-center font-weight-bold text-h5">
                {{ props.title }}
              </v-col>
            </v-row>
          </div>
          <slot></slot>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
