<script lang="ts" setup>
import {
  AddOutline,
  CheckmarkOutline,
  CloseOutline,
  PencilOutline,
  TrashOutline,
} from '@vicons/ionicons5';
import {computed, onUnmounted, ref, watch} from 'vue';
import {readSettingsJSONRaw, writeSettingsJSONRaw} from '../config/installConfig';
import {
  defaultProjectSettings,
  type ModelEntry,
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

/** 新建 / 编辑提供商弹窗 */
const providerModalShow = ref(false);
const providerModalIsEdit = ref(false);
const editingProviderId = ref<string | null>(null);
const providerForm = ref({
  name: '',
  baseUrl: '',
  apiKey: '',
});

const providerModalTitle = ref('新建模型提供商');

/** 添加 / 编辑模型弹窗 */
const modelModalShow = ref(false);
const modelModalIsEdit = ref(false);
const modelTargetProviderId = ref<string | null>(null);
const editingModelIndex = ref<number | null>(null);
const modelForm = ref({name: '', code: ''});

const modelModalProviderLabel = computed(() => {
  const id = modelTargetProviderId.value;
  if (!id) {
    return '';
  }
  const p = data.value.modelProviders.find((x) => x.id === id);
  if (!p) {
    return '';
  }
  const n = p.name.trim();
  return n || '未命名提供商';
});

const modelModalTitle = computed(() =>
  modelModalIsEdit.value ? '编辑模型' : '添加模型',
);

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

// 首次打开时挂载即 visible===true，无 false→true 变化，必须 immediate 才会执行拉盘
watch(
  () => props.visible,
  (v) => {
    if (v) {
      void reloadFromDisk();
    }
  },
  {immediate: true},
);

watch(
  data,
  () => {
    scheduleSave();
  },
  {deep: true},
);

function resetProviderFormFields() {
  providerForm.value = {name: '', baseUrl: '', apiKey: ''};
  editingProviderId.value = null;
  providerModalIsEdit.value = false;
}

function openCreateProviderModal() {
  resetProviderFormFields();
  providerModalTitle.value = '新建模型提供商';
  providerModalShow.value = true;
}

function openEditProviderModal(p: ModelProvider) {
  providerModalIsEdit.value = true;
  editingProviderId.value = p.id;
  providerModalTitle.value = '编辑模型提供商';
  providerForm.value = {
    name: p.name,
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
  };
  providerModalShow.value = true;
}

function confirmProviderModal() {
  const f = providerForm.value;
  if (providerModalIsEdit.value && editingProviderId.value) {
    const p = data.value.modelProviders.find(
      (x) => x.id === editingProviderId.value,
    );
    if (p) {
      p.name = f.name;
      p.baseUrl = f.baseUrl;
      p.apiKey = f.apiKey;
    }
  } else {
    data.value.modelProviders.push({
      id: newId(),
      name: f.name,
      baseUrl: f.baseUrl,
      apiKey: f.apiKey,
      models: [],
    });
  }
  providerModalShow.value = false;
}

function cancelProviderModal() {
  providerModalShow.value = false;
}

function removeProvider(idx: number) {
  data.value.modelProviders.splice(idx, 1);
}

function resetModelFormFields() {
  modelForm.value = {name: '', code: ''};
  modelTargetProviderId.value = null;
  modelModalIsEdit.value = false;
  editingModelIndex.value = null;
}

function openAddModelModal(p: ModelProvider) {
  modelModalIsEdit.value = false;
  editingModelIndex.value = null;
  modelTargetProviderId.value = p.id;
  modelForm.value = {name: '', code: ''};
  modelModalShow.value = true;
}

function openEditModelModal(p: ModelProvider, midx: number) {
  const m = p.models[midx];
  if (!m) {
    return;
  }
  modelModalIsEdit.value = true;
  modelTargetProviderId.value = p.id;
  editingModelIndex.value = midx;
  modelForm.value = {name: m.name, code: m.code};
  modelModalShow.value = true;
}

function confirmModelModal() {
  const id = modelTargetProviderId.value;
  if (!id) {
    return;
  }
  const p = data.value.modelProviders.find((x) => x.id === id);
  if (!p) {
    return;
  }
  if (modelModalIsEdit.value && editingModelIndex.value !== null) {
    const row = p.models[editingModelIndex.value];
    if (row) {
      row.name = modelForm.value.name;
      row.code = modelForm.value.code;
    }
  } else {
    p.models.push({
      name: modelForm.value.name,
      code: modelForm.value.code,
    });
  }
  modelModalShow.value = false;
}

function cancelModelModal() {
  modelModalShow.value = false;
}

function removeModel(p: ModelProvider, midx: number) {
  p.models.splice(midx, 1);
}

function providerDisplayName(p: ModelProvider) {
  const n = p.name.trim();
  return n || '未命名提供商';
}

function modelDisplayTitle(m: ModelEntry) {
  const n = m.name.trim();
  return n || '未命名';
}

function modelDisplayCode(m: ModelEntry) {
  const c = m.code.trim();
  return c || '—';
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
          <div class="provider-collapse-header">
            <span class="provider-name-label">{{ providerDisplayName(p) }}</span>
            <n-space :size="4" class="provider-header-actions" @click.stop>
              <n-tooltip placement="top" trigger="hover">
                <template #trigger>
                  <n-button
                    size="tiny"
                    quaternary
                    circle
                    aria-label="编辑提供商"
                    @click="openEditProviderModal(p)"
                  >
                    <template #icon>
                      <n-icon :component="PencilOutline" />
                    </template>
                  </n-button>
                </template>
                编辑提供商
              </n-tooltip>
              <n-tooltip placement="top" trigger="hover">
                <template #trigger>
                  <n-button
                    size="tiny"
                    quaternary
                    circle
                    type="primary"
                    aria-label="添加模型"
                    @click="openAddModelModal(p)"
                  >
                    <template #icon>
                      <n-icon :component="AddOutline" />
                    </template>
                  </n-button>
                </template>
                添加模型
              </n-tooltip>
            </n-space>
          </div>
        </template>

        <div class="models-block">
          <div class="models-head">
            <span class="muted">模型列表</span>
            <n-tooltip placement="top" trigger="hover">
              <template #trigger>
                <n-button
                  size="tiny"
                  quaternary
                  circle
                  type="primary"
                  aria-label="添加模型"
                  @click="openAddModelModal(p)"
                >
                  <template #icon>
                    <n-icon :component="AddOutline" />
                  </template>
                </n-button>
              </template>
              添加模型
            </n-tooltip>
          </div>

          <n-list
            v-if="p.models.length"
            bordered
            size="small"
            class="model-n-list"
          >
            <n-list-item v-for="(m, midx) in p.models" :key="midx">
              <n-thing
                :title="modelDisplayTitle(m)"
                :description="modelDisplayCode(m)"
                class="model-thing"
              />
              <template #suffix>
                <n-space :size="4" class="model-item-actions">
                  <n-tooltip placement="top" trigger="hover">
                    <template #trigger>
                      <n-button
                        size="tiny"
                        quaternary
                        circle
                        aria-label="编辑模型"
                        @click="openEditModelModal(p, midx)"
                      >
                        <template #icon>
                          <n-icon :component="PencilOutline" />
                        </template>
                      </n-button>
                    </template>
                    编辑模型
                  </n-tooltip>
                  <n-tooltip placement="top" trigger="hover">
                    <template #trigger>
                      <n-button
                        size="tiny"
                        quaternary
                        circle
                        type="error"
                        aria-label="删除模型"
                        @click="removeModel(p, midx)"
                      >
                        <template #icon>
                          <n-icon :component="TrashOutline" />
                        </template>
                      </n-button>
                    </template>
                    删除模型
                  </n-tooltip>
                </n-space>
              </template>
            </n-list-item>
          </n-list>
          <p v-else class="muted empty-models">
            暂无模型，点击「添加模型」填写表单添加
          </p>

          <n-tooltip placement="top" trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                quaternary
                circle
                type="error"
                class="remove-provider"
                aria-label="删除此提供商"
                @click="removeProvider(idx)"
              >
                <template #icon>
                  <n-icon :component="TrashOutline" />
                </template>
              </n-button>
            </template>
            删除此提供商
          </n-tooltip>
        </div>
      </n-collapse-item>
    </n-collapse>

    <p v-else class="muted empty-providers">暂无提供商配置</p>

    <n-tooltip placement="top" trigger="hover">
      <template #trigger>
        <n-button
          type="primary"
          size="small"
          circle
          class="add-provider"
          aria-label="添加提供商"
          @click="openCreateProviderModal"
        >
          <template #icon>
            <n-icon :component="AddOutline" />
          </template>
        </n-button>
      </template>
      添加提供商
    </n-tooltip>

    <n-modal
      v-model:show="providerModalShow"
      preset="card"
      :title="providerModalTitle"
      :bordered="false"
      :mask-closable="false"
      style="width: min(480px, calc(100vw - 32px))"
      @after-leave="resetProviderFormFields"
    >
      <n-form label-placement="left" label-width="88" class="provider-form">
        <n-form-item label="提供商名称">
          <n-input
            v-model:value="providerForm.name"
            placeholder="显示名称"
          />
        </n-form-item>
        <n-form-item label="Base URL">
          <n-input
            v-model:value="providerForm.baseUrl"
            placeholder="https://..."
          />
        </n-form-item>
        <n-form-item label="API Key">
          <n-input
            v-model:value="providerForm.apiKey"
            type="password"
            show-password-on="click"
            placeholder="可选"
          />
        </n-form-item>
      </n-form>
      <n-space justify="end" class="provider-modal-actions">
        <n-tooltip placement="top" trigger="hover">
          <template #trigger>
            <n-button
              quaternary
              circle
              aria-label="取消"
              @click="cancelProviderModal"
            >
              <template #icon>
                <n-icon :component="CloseOutline" />
              </template>
            </n-button>
          </template>
          取消
        </n-tooltip>
        <n-tooltip placement="top" trigger="hover">
          <template #trigger>
            <n-button
              type="primary"
              circle
              aria-label="确定"
              @click="confirmProviderModal"
            >
              <template #icon>
                <n-icon :component="CheckmarkOutline" />
              </template>
            </n-button>
          </template>
          确定
        </n-tooltip>
      </n-space>
    </n-modal>

    <n-modal
      v-model:show="modelModalShow"
      preset="card"
      :title="modelModalTitle"
      :bordered="false"
      :mask-closable="false"
      style="width: min(440px, calc(100vw - 32px))"
      @after-leave="resetModelFormFields"
    >
      <p v-if="modelModalProviderLabel" class="muted model-modal-hint">
        提供商：{{ modelModalProviderLabel }}
      </p>
      <n-form label-placement="left" label-width="72" class="model-form">
        <n-form-item label="名称">
          <n-input v-model:value="modelForm.name" placeholder="显示名称" />
        </n-form-item>
        <n-form-item label="代码">
          <n-input v-model:value="modelForm.code" placeholder="模型 ID / 代码" />
        </n-form-item>
      </n-form>
      <n-space justify="end" class="model-modal-actions">
        <n-tooltip placement="top" trigger="hover">
          <template #trigger>
            <n-button
              quaternary
              circle
              aria-label="取消"
              @click="cancelModelModal"
            >
              <template #icon>
                <n-icon :component="CloseOutline" />
              </template>
            </n-button>
          </template>
          取消
        </n-tooltip>
        <n-tooltip placement="top" trigger="hover">
          <template #trigger>
            <n-button
              type="primary"
              circle
              aria-label="确定"
              @click="confirmModelModal"
            >
              <template #icon>
                <n-icon :component="CheckmarkOutline" />
              </template>
            </n-button>
          </template>
          确定
        </n-tooltip>
      </n-space>
    </n-modal>
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

.provider-collapse-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding-right: 4px;
  box-sizing: border-box;
}

.provider-name-label {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-header-actions {
  flex-shrink: 0;
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

.model-n-list {
  border-radius: var(--n-border-radius);
}

.model-n-list :deep(.n-list-item) {
  padding-top: 6px;
  padding-bottom: 6px;
}

.model-thing :deep(.n-thing-header) {
  font-size: 13px;
}

.model-thing :deep(.n-thing-main__description) {
  font-size: 12px;
  font-family: Consolas, 'Courier New', monospace;
}

.model-item-actions {
  flex-shrink: 0;
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

.provider-form {
  margin-top: 4px;
}

.provider-modal-actions {
  margin-top: 16px;
}

.model-modal-hint {
  margin: 0 0 8px;
  font-size: 12px;
}

.model-form {
  margin-top: 4px;
}

.model-modal-actions {
  margin-top: 16px;
}
</style>
