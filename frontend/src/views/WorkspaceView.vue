<script lang="ts" setup>
defineProps<{
  /** 可选：当前打开的资源标题 */
  activeLabel?: string;
}>();
</script>

<template>
  <div class="workbench-dock-panel workspace">
    <h3>工作区</h3>
    <p v-if="activeLabel" class="muted active-label">当前：{{ activeLabel }}</p>
    <p v-else class="muted active-label">主要编辑与预览区域</p>
    <pre class="snippet">// 在此接 Monaco / 自定义编辑器、画布等
export function main() {
  // ...
}</pre>
  </div>
</template>

<style scoped>
.active-label {
  margin: 0 0 10px;
  font-size: 11px;
}

.snippet {
  margin-top: 8px;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--n-border-color);
  background: var(--n-color);
}
</style>
