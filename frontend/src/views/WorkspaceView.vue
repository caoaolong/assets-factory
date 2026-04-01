<script lang="ts" setup>
import { computed, ref } from 'vue';
import type { Connection, GraphNode } from '@vue-flow/core';
import { VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { AddOutline } from '@vicons/ionicons5';
import { NButton, NIcon, useThemeVars } from 'naive-ui';
import { changeColor, rgba as parseRgba } from 'seemly';
import { BaseFlowNode } from '../components/flow';
import type { FlowBaseNodeData } from '../components/flow/flowNodeTypes';

defineProps<{
  /** 可选：当前打开的资源标题 */
  activeLabel?: string;
}>();

const themeVars = useThemeVars();

/** 主题切换时刷新 MiniMap 内依赖 JS 颜色的渲染 */
const flowThemeSignature = computed(
  () =>
    `${themeVars.value.primaryColor}|${themeVars.value.primaryColorSuppl}|${themeVars.value.cardColor}|${themeVars.value.bodyColor}`,
);

const minimapMaskColor = computed(() =>
  changeColor(themeVars.value.cardColor, { alpha: 0.62 }),
);

const minimapMaskStrokeColor = computed(() => themeVars.value.primaryColor);

/**
 * Naive 的 --n-color-embedded、--n-border-color 等多由 n-card / n-menu 等组件挂在自身根节点，
 * 流程画布不在这些组件内时 var 未定义，会落到我们写的深色 fallback。此处用 themeVars 注入 --flow-*。
 */
const flowThemeCssVars = computed(() => {
  const t = themeVars.value;
  return {
    '--flow-embedded': t.cardColor,
    '--flow-header': t.actionColor,
    '--flow-border': t.borderColor,
    '--flow-divider': t.dividerColor,
    '--flow-text': t.textColor2,
    '--flow-text-muted': t.textColor3,
    '--flow-primary': t.primaryColor,
    '--flow-primary-suppl': t.primaryColorSuppl,
    '--flow-body': t.bodyColor,
  } as Record<string, string>;
});

/** 本地简化类型，避免 Vue Flow 的 Edge 联合在展开数组时触发 TS 深度实例化错误 */
type FlowNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data?: FlowBaseNodeData | { label?: string };
  selected?: boolean;
};

type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  animated?: boolean;
  selected?: boolean;
};

/** 初始示例：基于 BaseFlowNode 的连线 */
const nodes = ref<FlowNode[]>([
  {
    id: '1',
    type: 'base',
    position: { x: 60, y: 48 },
    data: {
      name: '资源输入',
      inputs: [],
      outputs: [
        {
          id: 'asset',
          label: '资产',
          dataType: 'AssetRef',
          color: '#a78bfa',
        },
      ],
    },
  },
  {
    id: '2',
    type: 'base',
    position: { x: 380, y: 32 },
    data: {
      name: '处理节点',
      inputs: [
        {
          id: 'in_asset',
          label: '上游',
          dataType: 'AssetRef',
          color: '#a78bfa',
        },
      ],
      outputs: [
        {
          id: 'result',
          label: '结果',
          dataType: 'Material',
          color: '#38bdf8',
        },
      ],
    },
  },
]);

const edges = ref<FlowEdge[]>([
  {
    id: 'e-asset',
    source: '1',
    target: '2',
    sourceHandle: 'asset',
    targetHandle: 'in_asset',
    animated: true,
  },
]);

let nodeIdSeq = 2;
let edgeIdSeq = 1;

function nextNodeId(): string {
  nodeIdSeq += 1;
  return String(nodeIdSeq);
}

function nextEdgeId(): string {
  edgeIdSeq += 1;
  return `e-${edgeIdSeq}`;
}

function onConnect(conn: Connection) {
  const dup = edges.value.some(
    (e) =>
      e.source === conn.source &&
      e.target === conn.target &&
      (e.sourceHandle ?? null) === (conn.sourceHandle ?? null) &&
      (e.targetHandle ?? null) === (conn.targetHandle ?? null),
  );
  if (dup) return;

  const edge: FlowEdge = {
    id: nextEdgeId(),
    source: conn.source,
    target: conn.target,
  };
  if (conn.sourceHandle) edge.sourceHandle = conn.sourceHandle;
  if (conn.targetHandle) edge.targetHandle = conn.targetHandle;
  edges.value.push(edge);
}

function addNode() {
  const id = nextNodeId();
  const data: FlowBaseNodeData = {
    name: `新节点 ${id}`,
    inputs: [
      {
        id: `in_${id}`,
        label: '输入',
        dataType: 'any',
        color: '#4ade80',
      },
    ],
    outputs: [
      {
        id: `out_${id}`,
        label: '输出',
        dataType: 'any',
        color: '#fb923c',
      },
    ],
  };
  nodes.value.push({
    id,
    type: 'base',
    position: { x: 80 + Math.random() * 280, y: 40 + Math.random() * 160 },
    data,
  });
}

/** 小地图节点取主连接色（与画布节点桩颜色呼应） */
function pickPortAccent(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as FlowBaseNodeData;
  return d.outputs?.[0]?.color ?? d.inputs?.[0]?.color;
}

/**
 * MiniMap 内 rect 的 fill / stroke 对 color-mix()、var(--n-*) 解析很差，常见直接变黑。
 * 回调里只返回 rgba / #hex；若要用插槽定制形状可再包一层 MiniMapNode：
 * https://vueflow.dev/guide/components/minimap-node.html
 */
function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
    const [r, g, b] = parseRgba(themeVars.value.primaryColor);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function minimapNodeColor(node: GraphNode) {
  const t = themeVars.value;
  const accent = pickPortAccent(node.data);
  if (accent) {
    return node.selected ? hexToRgba(accent, 0.58) : hexToRgba(accent, 0.38);
  }
  const [r, g, b] = parseRgba(t.primaryColorSuppl);
  const a = node.selected ? 0.52 : 0.3;
  return `rgba(${r},${g},${b},${a})`;
}

function minimapNodeStroke(node: GraphNode) {
  const t = themeVars.value;
  const accent = pickPortAccent(node.data);
  if (node.selected) {
    return accent ?? t.primaryColor;
  }
  if (accent) {
    return hexToRgba(accent, 0.92);
  }
  return changeColor(t.borderColor, { alpha: 0.88 });
}

function minimapNodeClass(_node: GraphNode) {
  return 'flow-mm-node';
}

</script>

<template>
  <div class="workbench-dock-panel workspace" :style="flowThemeCssVars">
    <div class="flow-canvas-wrap">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        class="flow-canvas"
        :default-zoom="1"
        :min-zoom="0.2"
        :max-zoom="2"
        fit-view-on-init
        @connect="onConnect"
      >
        <template #node-base="baseNodeProps">
          <BaseFlowNode v-bind="baseNodeProps">
            <template #form>
              <p class="flow-form-placeholder muted">
                表单区域
              </p>
            </template>
          </BaseFlowNode>
        </template>
        <Background :gap="16" pattern-color="var(--flow-divider, #e5e5e5)" />
        <!-- 视图控制：见 https://vueflow.dev/guide/components/controls.html -->
        <Controls
          position="top-right"
          class="flow-workspace-controls-bar nodrag"
        >
          <template #top>
            <NButton
              size="tiny"
              quaternary
              circle
              class="flow-control-add-btn"
              @click="addNode"
            >
              <template #icon>
                <NIcon :component="AddOutline" />
              </template>
            </NButton>
          </template>
          <template #default>
            <span
              v-if="activeLabel"
              class="flow-toolbar-active-label muted"
              :title="activeLabel"
            >{{ activeLabel }}</span>
          </template>
        </Controls>
        <MiniMap
          :key="flowThemeSignature"
          pannable
          zoomable
          :node-color="minimapNodeColor"
          :node-stroke-color="minimapNodeStroke"
          :node-class-name="minimapNodeClass"
          :node-stroke-width="1.35"
          :node-border-radius="8"
          :mask-color="minimapMaskColor"
          :mask-stroke-color="minimapMaskStrokeColor"
          :mask-stroke-width="1"
          :mask-border-radius="6"
        />
      </VueFlow>
    </div>
  </div>
</template>

<style scoped>
.flow-canvas-wrap {
  flex: 1;
  min-height: 240px;
  position: relative;
  border-radius: 6px;
  border: 1px solid var(--flow-border, #e0e0e0);
  overflow: hidden;
}

.flow-canvas {
  width: 100%;
  height: 100%;
}

.workspace {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.flow-form-placeholder {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
}
</style>

<!-- Vue Flow 要求样式勿用 scoped，见 https://vueflow.dev/guide/getting-started.html -->
<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
@import '@vue-flow/minimap/dist/style.css';

/*
 * MiniMap 面板与流程节点阴影：随 html.theme-light | theme-dark（与 applyTheme 一致）
 * mask 颜色由脚本内 minimapMaskColor（Naive themeVars）提供
 */
.theme-dark .flow-canvas {
  --flow-node-shadow: 0 2px 10px rgba(0, 0, 0, 0.32);
  --flow-node-toolbar-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}

.theme-light .flow-canvas {
  --flow-node-shadow: 0 2px 12px rgba(0, 0, 0, 0.07);
  --flow-node-toolbar-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.flow-canvas .vue-flow__edge-path {
  stroke: var(--flow-text-muted, #888) !important;
}

.flow-canvas .vue-flow__edge.selected .vue-flow__edge-path,
.flow-canvas .vue-flow__edge:focus .vue-flow__edge-path,
.flow-canvas .vue-flow__edge:focus-visible .vue-flow__edge-path {
  stroke: var(--flow-primary, #18a058) !important;
}

.flow-canvas .vue-flow__connectionline {
  stroke: var(--flow-primary, #18a058);
}

.flow-canvas .vue-flow__edge-textbg {
  fill: var(--flow-embedded, #fff);
}

.flow-canvas .vue-flow__edge-text {
  fill: var(--flow-text, #333);
}

.flow-canvas .vue-flow__minimap {
  background-color: var(--flow-embedded, #f5f5f5);
  border: 1px solid var(--flow-border, #e0e0e0);
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.theme-light .flow-canvas .vue-flow__minimap {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

/* MiniMap 节点：立体阴影、选中高亮（配合 minimapNodeColor / Stroke 回调） */
.flow-canvas .vue-flow__minimap-node.flow-mm-node {
  transition:
    filter 0.18s ease,
    opacity 0.18s ease;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.28));
}

.theme-light .flow-canvas .vue-flow__minimap-node.flow-mm-node {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.12));
}

.flow-canvas .vue-flow__minimap-node.flow-mm-node.dragging {
  opacity: 0.88;
}

.flow-canvas .vue-flow__minimap-node.flow-mm-node.selected {
  stroke-width: 2.25px;
  filter: drop-shadow(0 0 0 1px var(--flow-primary, #18a058))
    drop-shadow(0 2px 8px color-mix(in srgb, var(--flow-primary, #18a058) 35%, transparent));
}

.theme-light .flow-canvas .vue-flow__minimap-node.flow-mm-node.selected {
  filter: drop-shadow(0 0 0 1px var(--flow-primary, #18a058))
    drop-shadow(0 2px 6px color-mix(in srgb, var(--flow-primary, #18a058) 28%, transparent));
}

/* 画布内 Controls：横向紧凑工具条（与默认纵向底栏区分） */
.flow-canvas .vue-flow__controls.flow-workspace-controls-bar {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  margin: 6px 8px;
  padding: 3px 4px;
  border-radius: 6px;
  border: 1px solid var(--flow-border, #e0e0e0);
  background: var(--flow-embedded, #f5f5f5);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
}

.theme-dark .flow-canvas .vue-flow__controls.flow-workspace-controls-bar {
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
}

.flow-canvas .flow-workspace-controls-bar .vue-flow__controls-button {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: transparent;
  border: none;
  border-bottom: none;
}

.flow-canvas .flow-workspace-controls-bar .vue-flow__controls-button:hover {
  background: var(--flow-header, rgba(0, 0, 0, 0.06));
}

.flow-canvas .flow-workspace-controls-bar .vue-flow__controls-button svg {
  fill: var(--flow-text, #333);
  fill-opacity: 1;
}

.flow-canvas .flow-workspace-controls-bar .vue-flow__controls-button:disabled svg {
  fill-opacity: 0.35;
}

.flow-canvas .flow-workspace-controls-bar .flow-control-add-btn {
  width: 22px;
  height: 22px;
  min-width: 22px;
  padding: 0;
  margin-right: 2px;
}

.flow-canvas .flow-toolbar-active-label {
  margin-left: 6px;
  padding-left: 6px;
  border-left: 1px solid var(--flow-divider, #e5e5e5);
  max-width: 140px;
  font-size: 10px;
  line-height: 22px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
