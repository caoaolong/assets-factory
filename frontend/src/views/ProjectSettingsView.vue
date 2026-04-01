<script lang="ts" setup>
import {onUnmounted, ref, watch} from 'vue';
import {readSettingsJSONRaw, writeSettingsJSONRaw} from '../config/installConfig';
import {
  defaultProjectSettings,
  type ModelProvider,
  parseProjectSettings,
  serializeProjectSettings,
  type ProjectSettingsData,
} from '../config/projectSettingsTypes';

const props = defineProps<{
  visible: boolean;
}>();

const data = ref<ProjectSettingsData>(defaultProjectSettings());
const loadGen = ref(0);
let suppressSave = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function scheduleSave() {
  if (suppressSave) {
    return;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void writeSettingsJSONRaw(serializeProjectSettings(data.value));
  }, 400);
}

async function reloadFromDisk() {
  const g = ++loadGen.value;
  const raw = await readSettingsJSONRaw();
  if (g !== loadGen.value) {
    return;
  }
  suppressSave = true;
  data.value = parseProjectSettings(raw);
  suppressSave = false;
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      void reloadFromDisk();
    }
  },
);

watch(
  data,
  () => {
    scheduleSave();
  },
  {deep: true},
);

function addProvider() {
  data.value.modelProviders.push({
    id: newId(),
    name: '',
    baseUrl: '',
    apiKey: '',
    models: [],
  });
}

function removeProvider(idx: number) {
  data.value.modelProviders.splice(idx, 1);
}

function addModel(p: ModelProvider) {
  p.models.push({name: '', code: ''});
}

function removeModel(p: ModelProvider, midx: number) {
  p.models.splice(midx, 1);
}

onUnmounted(() => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
});
</script>

<template>
  <div class="project-settings workbench-dock-panel">
    <h3 class="section-title">模型管理</h3>
    <p class="hint muted">
      配置将保存至应用安装目录下的 <code>settings.json</code>。
    </p>

    <n-collapse
      v-if="data.modelProviders.length"
      :default-expanded-names="data.modelProviders.map((p) => p.id)"
    >
      <n-collapse-item
        v-for="(p, idx) in data.modelProviders"
        :key="p.id"
        :name="p.id"
      >
        <template #header>
          <div class="provider-head" @click.stop>
            <n-input
              v-model:value="p.name"
              size="small"
              placeholder="提供商名称"
              class="ph-name"
            />
            <n-input
              v-model:value="p.baseUrl"
              size="small"
              placeholder="Base URL"
              class="ph-url"
            />
            <n-input
              v-model:value="p.apiKey"
              size="small"
              type="password"
              show-password-on="click"
              placeholder="API Key"
              class="ph-key"
            />
          </div>
        </template>

        <div class="models-block">
          <div class="models-head">
            <span class="muted">模型列表</span>
            <n-button size="tiny" quaternary @click="addModel(p)">
              添加模型
            </n-button>
          </div>
          <ul v-if="p.models.length" class="model-list">
            <li v-for="(m, midx) in p.models" :key="midx" class="model-row">
              <n-input
                v-model:value="m.name"
                size="small"
                placeholder="名称"
              />
              <n-input
                v-model:value="m.code"
                size="small"
                placeholder="代码"
              />
              <n-button
                size="tiny"
                quaternary
                type="error"
                @click="removeModel(p, midx)"
              >
                删除
              </n-button>
            </li>
          </ul>
          <p v-else class="muted empty-models">暂无模型，点击「添加模型」</p>

          <n-button
            size="small"
            quaternary
            type="error"
            class="remove-provider"
            @click="removeProvider(idx)"
          >
            删除此提供商
          </n-button>
        </div>
      </n-collapse-item>
    </n-collapse>

    <p v-else class="muted empty-providers">暂无提供商配置</p>

    <n-button type="primary" size="small" class="add-provider" @click="addProvider">
      添加提供商
    </n-button>
  </div>
</template>

<style scoped>
.project-settings {
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

.provider-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding-right: 8px;
}

.ph-name {
  flex: 1 1 120px;
  min-width: 100px;
}

.ph-url {
  flex: 2 1 200px;
  min-width: 160px;
}

.ph-key {
  flex: 1 1 160px;
  min-width: 120px;
}

.models-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.models-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.model-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.model-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px dashed var(--n-divider-color);
}

.empty-models,
.empty-providers {
  margin: 0;
  font-size: 12px;
}

.add-provider {
  align-self: flex-start;
}

.remove-provider {
  align-self: flex-start;
}
</style>
