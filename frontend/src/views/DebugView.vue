<script lang="ts" setup>
const lines = [
  '[调试] WebView runtime ready',
  '[调试] DockLayout initialized',
  '[调试] 未附加调试器（占位）',
];
</script>

<template>
  <div class="workbench-dock-panel debug-view">
    <h3>调试</h3>
    <p class="muted hint">断点、变量与调试控制台（占位）</p>
    <pre>{{ lines.join('\n') }}</pre>
  </div>
</template>

<style scoped>
.hint {
  margin: 0 0 8px;
  font-size: 11px;
}

.debug-view pre {
  margin-top: 4px;
  padding: 8px;
  border-radius: 6px;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  min-height: 72px;
}
</style>
