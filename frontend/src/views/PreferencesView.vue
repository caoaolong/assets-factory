<script lang="ts" setup>
import {createDiscreteApi} from 'naive-ui';
import {ref} from 'vue';
import {saveUserProfileImmediate} from '../config/userProfile';
import type {ThemePreference} from '../theme/settings';

const {message} = createDiscreteApi(['message']);

defineProps<{
  theme: ThemePreference;
}>();

const emit = defineEmits<{
  'update:theme': [value: ThemePreference];
}>();

const saving = ref(false);

async function onSave(theme: ThemePreference) {
  if (saving.value) {
    return;
  }
  saving.value = true;
  try {
    await saveUserProfileImmediate({theme});
    message.success('首选项已保存至 profile.json');
  } catch {
    message.error('保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="prefs-panel workbench-dock-panel dock-panel-with-save">
    <div class="prefs-body">
      <h3 class="section-title">界面</h3>
      <p class="hint muted">
        首选项将保存至应用安装目录下的 <code>profile.json</code>。修改后请点击右下角「保存」写入磁盘。
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

    <div class="panel-save-bar">
      <n-button
        type="primary"
        :loading="saving"
        @click="onSave(theme)"
      >
        保存
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.prefs-panel {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  box-sizing: border-box;
  gap: 0;
}

.dock-panel-with-save {
  overflow: hidden;
}

.prefs-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
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

.panel-save-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 16px 0 8px;
  margin-top: auto;
}
</style>
