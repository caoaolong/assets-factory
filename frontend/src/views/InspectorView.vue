<script lang="ts" setup>
const props = defineProps<{
  selectionLabel?: string;
}>();
</script>

<template>
  <div class="workbench-dock-panel">
    <h3>属性 / 检查器</h3>
    <p class="muted hint">当前选中项的属性与校验</p>
    <dl class="props-list">
      <dt>名称</dt>
      <dd>{{ props.selectionLabel ?? '（未选择）' }}</dd>
      <dt>类型</dt>
      <dd>—</dd>
      <dt>只读</dt>
      <dd>false</dd>
    </dl>
  </div>
</template>

<style scoped>
.hint {
  margin: 0 0 10px;
  font-size: 11px;
}

.props-list {
  margin: 0;
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 6px 10px;
  font-size: 11px;
}

.props-list dt {
  margin: 0;
  color: var(--n-text-color-3);
}

.props-list dd {
  margin: 0;
}
</style>
