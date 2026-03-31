<script lang="ts" setup>
const lines = [
  '[日志] pnpm run dev',
  '[日志] [vite] connected',
  '[日志] 构建完成',
];
</script>

<template>
  <div class="workbench-dock-panel log-view">
    <h3>日志</h3>
    <p class="muted hint">构建与运行输出</p>
    <pre>{{ lines.join('\n') }}</pre>
  </div>
</template>

<style scoped>
.hint {
  margin: 0 0 8px;
  font-size: 11px;
}

.log-view pre {
  margin-top: 4px;
  padding: 8px;
  border-radius: 6px;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  min-height: 72px;
}
</style>
