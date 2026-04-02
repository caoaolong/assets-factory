<script lang="ts" setup>
import {createDiscreteApi} from 'naive-ui';
import {ref, watch} from 'vue';
import {readSettingsJSONRaw, writeSettingsJSONRaw} from '../config/installConfig';
import {
  defaultProjectSettings,
  parseProjectSettings,
  serializeProjectSettings,
  type ProjectSettingsData,
} from '../config/projectSettingsTypes';

const {message} = createDiscreteApi(['message']);

const props = defineProps<{
  visible: boolean;
}>();

const data = ref<ProjectSettingsData>(defaultProjectSettings());
const loadGen = ref(0);

const saving = ref(false);

async function reloadFromDisk() {
  const g = ++loadGen.value;
  const raw = await readSettingsJSONRaw();
  if (g !== loadGen.value) {
    return;
  }
  data.value = parseProjectSettings(raw);
}

async function saveNow() {
  if (saving.value) {
    return;
  }
  saving.value = true;
  try {
    await writeSettingsJSONRaw(serializeProjectSettings(data.value));
    message.success('已保存至 settings.json');
  } catch {
    message.error('保存失败');
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      void reloadFromDisk();
    }
  },
  {immediate: true},
);
</script>

<template>
  <div class="project-settings workbench-dock-panel dock-panel-with-save">
    <div class="settings-body">
      <h3 class="section-title">Dashscope</h3>
      <p class="hint muted">
        用于阿里云百炼 / Dashscope 兼容接口。配置保存至安装目录下的
        <code>settings.json</code>。修改后请点击右下角「保存」写入磁盘。
      </p>

      <n-form label-placement="left" label-width="120" class="dash-form">
        <n-form-item label="API Key">
          <n-input
            v-model:value="data.dashscopeApiKey"
            placeholder="sk-..."
            clearable
            spellcheck="false"
            autocomplete="off"
          />
        </n-form-item>
      </n-form>
    </div>

    <div class="panel-save-bar">
      <n-button
        type="primary"
        :loading="saving"
        @click="saveNow"
      >
        保存
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.project-settings {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  box-sizing: border-box;
  gap: 0;
}

.dock-panel-with-save {
  overflow: hidden;
}

.settings-body {
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

.dash-form {
  margin-top: 4px;
  max-width: 520px;
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
