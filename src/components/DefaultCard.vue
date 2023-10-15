<script setup lang="ts">
const props = defineProps<{
  title?: string
  color?: string
  noDivider?: boolean
  showClose?: boolean
}>()

defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <v-container>
    <v-row class="d-flex justify-center">
      <v-col cols="12" sm="10" md="8" lg="6" xl="4">
        <v-card>
          <v-toolbar v-if="props.title" :color="color || 'white'">
            <template v-if="showClose" #extension>
              <div
                class="px-3 text-center font-weight-bold text-h5"
                style="width: 100%">
                {{ props.title }}
              </div>
            </template>
            <template v-if="showClose" #default>
              <div class="px-3 d-flex justify-end" style="width: 100%">
                <v-btn color="red" @click="$emit('close')" variant="outlined">
                  <slot name="close"><v-icon>mdi-close</v-icon> 強制終了</slot>
                </v-btn>
              </div>
            </template>
            <template v-else #default>
              <div
                class="px-3 text-center font-weight-bold text-h5"
                style="width: 100%">
                {{ props.title }}
              </div>
            </template>
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
