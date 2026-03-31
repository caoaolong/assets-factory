import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import {NaiveUiResolver} from 'unplugin-vue-components/resolvers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
// 强制全项目（含预构建依赖）共用同一份 Vue，避免 renderSlot 报 Cannot read properties of null (reading 'ce')
export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [NaiveUiResolver()],
      dts: true,
    }),
  ],
  resolve: {
    dedupe: ['vue'],
    alias: {
      vue: path.resolve(__dirname, 'node_modules/vue/dist/vue.esm-bundler.js'),
    },
  },
})
