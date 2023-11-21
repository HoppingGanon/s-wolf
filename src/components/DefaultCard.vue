<script setup lang="ts">
const props = defineProps<{
  title?: string
  color?: string
  noDivider?: boolean
  showClose?: boolean
  showLogo?: boolean
}>()

defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <v-container>
    <template v-if="showLogo">
      <v-row class="d-flex justify-center">
        <v-col cols="4" sm="3" md="2" lg="1" xl="1">
          <v-avatar size="100%" color="secondary" class="py-3 pl-1 pr-5">
            <v-img :src="`/icon.svg`" />
          </v-avatar>
        </v-col>
      </v-row>
      <v-row>
        <v-col class="d-flex justify-center">
          <div class="text-white text-h4 font-weight-bold">s-wolf</div>
        </v-col>
      </v-row>
    </template>
    <v-row class="d-flex justify-center">
      <v-col cols="12" sm="10" md="8" lg="6" xl="4">
        <v-card>
          <v-toolbar v-if="props.title" :color="color || '#0000'">
            <template v-if="showClose" #extension>
              <div
                class="pt-5 px-3 text-center font-weight-bold text-h5"
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
                class="pt-5 px-3 text-center font-weight-bold text-h5"
                style="width: 100%">
                {{ props.title }}
              </div>
            </template>
          </v-toolbar>

          <div
            v-if="!noDivider"
            :class="$vuetify.display.mdAndUp ? 'pa-4' : 'pa-2'">
            <v-divider></v-divider>
            <slot></slot>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
