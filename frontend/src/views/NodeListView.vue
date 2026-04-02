<script lang="ts" setup>
import {computed, ref, watch} from 'vue';
import {readNodesJSONRaw, writeNodesJSONRaw} from '../config/installConfig';
import {
  defaultNodesDocument,
  parseNodesDocument,
  serializeNodesDocument,
  type NodeDefinition,
  type NodesDocument,
} from '../config/nodesTypes';

const props = defineProps<{
  visible: boolean;
}>();

const doc = ref<NodesDocument>(defaultNodesDocument());
const selectedId = ref<string>('');
const loadGen = ref(0);
const loadError = ref<string | null>(null);

const selectedNode = computed<NodeDefinition | null>(() => {
  const id = selectedId.value;
  if (!id) {
    return null;
  }
  return doc.value.nodes.find((n) => n.id === id) ?? null;
});

async function loadAndRender() {
  loadError.value = null;
  const g = ++loadGen.value;
  let raw = '';
  try {
    raw = await readNodesJSONRaw();
  } catch (e) {
    if (g !== loadGen.value) {
      return;
    }
    loadError.value = e instanceof Error ? e.message : String(e);
    doc.value = defaultNodesDocument();
    selectedId.value = doc.value.nodes[0]?.id ?? '';
    return;
  }
  if (g !== loadGen.value) {
    return;
  }
  const emptyFile = !raw.trim();
  const parsed = parseNodesDocument(raw);
  doc.value = parsed;
  if (!selectedId.value || !parsed.nodes.some((n) => n.id === selectedId.value)) {
    selectedId.value = parsed.nodes[0]?.id ?? '';
  }
  /** 文件不存在或为空时写入默认节点，便于安装目录落盘 */
  if (emptyFile && parsed.nodes.length > 0) {
    try {
      await writeNodesJSONRaw(serializeNodesDocument(parsed));
    } catch {
      /* 忽略首次写入失败，界面仍展示默认数据 */
    }
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      void loadAndRender();
    }
  },
  {immediate: true},
);

function selectNode(n: NodeDefinition) {
  selectedId.value = n.id;
}
</script>

<template>
  <div class="node-list-view workbench-dock-panel">
    <n-alert
      v-if="loadError"
      type="error"
      :bordered="false"
      class="load-alert"
    >
      加载 nodes.json 失败：{{ loadError }}
    </n-alert>

    <div class="node-list-layout">
      <aside class="node-sidebar" aria-label="节点列表">
        <n-card
          :bordered="true"
          size="small"
          class="sidebar-card"
          :content-style="{ padding: '8px 0' }"
        >
          <template #header>
            <span class="sidebar-card-title">节点列表</span>
          </template>
          <nav class="sidebar-nav">
            <button
              v-for="n in doc.nodes"
              :key="n.id"
              type="button"
              class="sidebar-item"
              :class="{ 'sidebar-item--active': n.id === selectedId }"
              @click="selectNode(n)"
            >
              <span class="sidebar-item-name">{{ n.name || '未命名' }}</span>
              <n-tag size="tiny" :bordered="false" round class="sidebar-item-tag">
                {{ n.category }}
              </n-tag>
            </button>
          </nav>
        </n-card>
      </aside>

      <main class="node-detail" aria-label="节点信息">
        <n-card
          v-if="selectedNode"
          :title="selectedNode.name || '未命名'"
          :bordered="true"
          size="small"
          class="node-main-card"
          :segmented="{ content: true, footer: false }"
        >
          <template #header-extra>
            <n-tag type="info" size="small" round>
              {{ selectedNode.category }}
            </n-tag>
          </template>

          <div class="node-cards-stack">
            <n-card
              title="节点描述"
              size="small"
              embedded
              :bordered="false"
              class="inner-card"
            >
              <p class="desc-text">
                {{ selectedNode.description || '暂无描述' }}
              </p>
            </n-card>

            <n-card
              title="输入参数"
              size="small"
              embedded
              :bordered="false"
              class="inner-card"
            >
              <n-space v-if="selectedNode.inputs.length" wrap :size="[8, 8]">
                <n-tag
                  v-for="(p, i) in selectedNode.inputs"
                  :key="'in-' + i"
                  size="medium"
                  round
                  :bordered="false"
                  type="success"
                >
                  {{ p.name || '未命名' }}
                </n-tag>
              </n-space>
              <span v-else class="muted empty-inline">暂无输入参数</span>
            </n-card>

            <n-card
              title="输出参数"
              size="small"
              embedded
              :bordered="false"
              class="inner-card"
            >
              <n-space v-if="selectedNode.outputs.length" wrap :size="[8, 8]">
                <n-tag
                  v-for="(p, i) in selectedNode.outputs"
                  :key="'out-' + i"
                  size="medium"
                  round
                  :bordered="false"
                  type="warning"
                >
                  {{ p.name || '未命名' }}
                </n-tag>
              </n-space>
              <span v-else class="muted empty-inline">暂无输出参数</span>
            </n-card>
          </div>
        </n-card>

        <n-card
          v-else
          :bordered="true"
          size="small"
          class="empty-card"
        >
          <n-empty description="请从左侧选择一个节点查看详情" />
        </n-card>
      </main>
    </div>
  </div>
</template>

<style scoped>
.node-list-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px !important;
  overflow: hidden;
  box-sizing: border-box;
  gap: 10px;
  background: var(--n-color-embedded);
}

.load-alert {
  flex-shrink: 0;
}

.node-list-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  gap: 12px;
}

.node-sidebar {
  width: 220px;
  flex-shrink: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sidebar-card :deep(.n-card__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sidebar-card-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.sidebar-nav {
  flex: 1;
  overflow: auto;
  padding: 0 8px 8px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 10px 10px;
  margin-bottom: 4px;
  border: none;
  border-radius: var(--n-border-radius);
  background: transparent;
  color: var(--n-text-color);
  font-size: 13px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.sidebar-item:hover {
  background: var(--n-color-hover);
}

.sidebar-item--active {
  background: var(--n-color-pressed);
  box-shadow: inset 0 0 0 1px var(--n-border-color);
  font-weight: 500;
}

.sidebar-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-item-tag {
  flex-shrink: 0;
  opacity: 0.85;
}

.node-detail {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.node-main-card {
  flex: 1;
  min-height: 0;
}

.node-main-card :deep(.n-card-header) {
  padding-top: 14px;
  padding-bottom: 12px;
}

.node-main-card :deep(.n-card-header__main) {
  font-size: 15px;
  font-weight: 600;
}

.node-cards-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inner-card :deep(.n-card-header) {
  padding-bottom: 8px;
}

.inner-card :deep(.n-card-header__main) {
  font-size: 12px;
  font-weight: 600;
  color: var(--n-text-color-2);
}

.desc-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--n-text-color);
  white-space: pre-wrap;
}

.empty-inline {
  font-size: 13px;
}

.empty-card {
  flex: 1;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-card :deep(.n-card__content) {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
