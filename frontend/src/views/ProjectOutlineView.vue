<script lang="ts" setup>
const projectFiles = [
  'src/main.ts',
  'src/App.vue',
  'src/style.css',
  'wails.json',
  'go.mod',
  'README.md',
];
</script>

<template>
  <div class="workbench-dock-panel">
    <h3>工程大纲</h3>
    <p class="muted hint">资源与工程结构</p>
    <ul>
      <li v-for="item in projectFiles" :key="item">{{ item }}</li>
    </ul>
  </div>
</template>

<style scoped>
.hint {
  margin: 0 0 8px;
  font-size: 11px;
}
</style>
