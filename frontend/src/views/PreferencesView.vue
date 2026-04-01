<script lang="ts" setup>
import type {ThemePreference} from '../theme/settings';

defineProps<{
  theme: ThemePreference;
}>();

const emit = defineEmits<{
  'update:theme': [value: ThemePreference];
}>();
</script>

<template>
  <div class="prefs-panel workbench-dock-panel">
    <h3 class="section-title">界面</h3>
    <p class="hint muted">
      首选项将保存至应用安装目录下的 <code>profile.json</code>。
    </p>
    <n-form label-placement="left" label-align="right" label-width="72">
      <n-form-item label="主题">
        <n-radio-group
          :value="theme"
          @update:value="emit('update:theme', $event)"
        >
          <n-space vertical :size="10">
            <n-radio value="system">跟随系统</n-radio>
            <n-radio value="light">亮色</n-radio>
            <n-radio value="dark">暗色</n-radio>
          </n-space>
        </n-radio-group>
      </n-form-item>
    </n-form>
  </div>
</template>

<style scoped>
.prefs-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.hint {
  margin: 0;
  font-size: 11px;
}

.hint code {
  font-size: 11px;
}
</style>
