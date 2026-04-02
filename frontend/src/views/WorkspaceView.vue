<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import type { Connection, GraphNode } from '@vue-flow/core';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import type { OnConnectStartParams } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { useThemeVars } from 'naive-ui';
import { changeColor, rgba as parseRgba } from 'seemly';
import { BaseFlowNode, ImageGenFlowNode } from '../components/flow';
import type {
  FlowBaseNodeData,
  FlowImageGenNodeData,
} from '../components/flow/flowNodeTypes';
import type { NodeDefinition } from '../config/nodesTypes';
import {
  parseNodesDocument,
  defaultNodesDocument,
  serializeNodesDocument,
} from '../config/nodesTypes';
import { readNodesJSONRaw, writeNodesJSONRaw } from '../config/installConfig';

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
  data?: FlowBaseNodeData | FlowImageGenNodeData | { label?: string };
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

const nodes = ref<FlowNode[]>([]);
const edges = ref<FlowEdge[]>([]);

let nodeIdSeq = 0;
let edgeIdSeq = 0;

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

/* ── 节点定义注册表 & 创建工厂 ─────────────────────────── */

const nodeDefinitions = ref<NodeDefinition[]>([]);

async function loadNodeDefinitions() {
  let raw = await readNodesJSONRaw();
  if (!raw.trim()) {
    const doc = defaultNodesDocument();
    await writeNodesJSONRaw(serializeNodesDocument(doc));
    raw = serializeNodesDocument(doc);
  }
  nodeDefinitions.value = parseNodesDocument(raw).nodes;
}

onMounted(loadNodeDefinitions);

const PORT_COLOR_PALETTE = [
  '#8b5cf6', '#06b6d4', '#a78bfa', '#38bdf8', '#f59e0b',
  '#10b981', '#ec4899', '#f97316', '#6366f1', '#14b8a6',
];

function paramColor(idx: number): string {
  return PORT_COLOR_PALETTE[idx % PORT_COLOR_PALETTE.length];
}

/** 已知节点定义 id → Vue Flow node type 映射 */
const NODE_TYPE_MAP: Record<string, string> = {
  'image-generation': 'imageGen',
};

function buildFlowNodeFromDef(
  def: NodeDefinition,
  position: { x: number; y: number },
): FlowNode {
  const id = nextNodeId();
  const vfType = NODE_TYPE_MAP[def.id] ?? 'base';

  const inputs = def.inputs.map((p, i) => ({
    id: `in_${id}_${i}`,
    label: p.name,
    dataType: p.name,
    color: paramColor(i),
  }));

  const outputs = def.outputs.map((p, i) => ({
    id: `out_${id}_${i}`,
    label: p.name,
    dataType: p.name,
    color: paramColor(i + def.inputs.length),
  }));

  const baseData: FlowBaseNodeData = { name: def.name, inputs, outputs };

  if (vfType === 'imageGen') {
    const data: FlowImageGenNodeData = { ...baseData, prompt: '' };
    return { id, type: vfType, position, data };
  }

  return { id, type: vfType, position, data: baseData };
}

/* ── 右键画布上下文菜单 ─────────────────────────────────── */

const { screenToFlowCoordinate } = useVueFlow();

const ctxMenu = ref<{
  show: boolean;
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  /** 连线松开时携带的源连接信息，null 表示纯右键 */
  pending: {
    nodeId: string;
    handleId: string;
    handleType: 'source' | 'target';
  } | null;
  filterDataType: string | null;
}>({
  show: false,
  x: 0,
  y: 0,
  flowX: 0,
  flowY: 0,
  pending: null,
  filterDataType: null,
});

const filteredNodeDefs = computed(() => {
  const ft = ctxMenu.value.filterDataType;
  if (!ft) return nodeDefinitions.value;
  const pending = ctxMenu.value.pending;
  if (!pending) return nodeDefinitions.value;
  if (pending.handleType === 'source') {
    return nodeDefinitions.value.filter((d) =>
      d.inputs.some((p) => p.name === ft),
    );
  }
  return nodeDefinitions.value.filter((d) =>
    d.outputs.some((p) => p.name === ft),
  );
});

function showContextMenu(
  screenX: number,
  screenY: number,
  pending: typeof ctxMenu.value.pending = null,
  filterDataType: string | null = null,
) {
  const flow = screenToFlowCoordinate({ x: screenX, y: screenY });
  ctxMenu.value = {
    show: true,
    x: screenX,
    y: screenY,
    flowX: flow.x,
    flowY: flow.y,
    pending,
    filterDataType,
  };
}

function hideContextMenu() {
  ctxMenu.value.show = false;
}

function onPaneContextMenu(ev: MouseEvent) {
  ev.preventDefault();
  showContextMenu(ev.clientX, ev.clientY);
}

function onCtxMenuSelect(def: NodeDefinition) {
  const pos = { x: ctxMenu.value.flowX, y: ctxMenu.value.flowY };
  const newNode = buildFlowNodeFromDef(def, pos);
  nodes.value.push(newNode);

  const pending = ctxMenu.value.pending;
  if (pending && newNode.data && 'inputs' in newNode.data && 'outputs' in newNode.data) {
    const nd = newNode.data as FlowBaseNodeData;
    if (pending.handleType === 'source') {
      const targetPort = nd.inputs.find(
        (p) => p.dataType === ctxMenu.value.filterDataType,
      );
      if (targetPort) {
        edges.value.push({
          id: nextEdgeId(),
          source: pending.nodeId,
          target: newNode.id,
          sourceHandle: pending.handleId,
          targetHandle: targetPort.id,
        });
      }
    } else {
      const sourcePort = nd.outputs.find(
        (p) => p.dataType === ctxMenu.value.filterDataType,
      );
      if (sourcePort) {
        edges.value.push({
          id: nextEdgeId(),
          source: newNode.id,
          target: pending.nodeId,
          sourceHandle: sourcePort.id,
          targetHandle: pending.handleId,
        });
      }
    }
  }

  hideContextMenu();
}

/* ── 拖线在空白处松开 → 弹出节点菜单 ────────────────────── */

let pendingConnectStart: {
  nodeId: string;
  handleId: string;
  handleType: 'source' | 'target';
} | null = null;

function onConnectStart(params: { event?: MouseEvent | TouchEvent } & OnConnectStartParams) {
  if (params.nodeId && params.handleId) {
    pendingConnectStart = {
      nodeId: params.nodeId,
      handleId: params.handleId,
      handleType: (params.handleType ?? 'source') as 'source' | 'target',
    };
  }
}

function onConnectEnd(ev?: MouseEvent | TouchEvent) {
  if (!pendingConnectStart || !ev) {
    pendingConnectStart = null;
    return;
  }
  const mouseEv = ev instanceof MouseEvent ? ev : ev.changedTouches?.[0];
  if (!mouseEv) {
    pendingConnectStart = null;
    return;
  }

  const target = (ev as MouseEvent).target as HTMLElement;
  if (target?.closest('.vue-flow__handle')) {
    pendingConnectStart = null;
    return;
  }

  const sourceNode = nodes.value.find(
    (n) => n.id === pendingConnectStart!.nodeId,
  );
  if (!sourceNode || !sourceNode.data) {
    pendingConnectStart = null;
    return;
  }

  const nd = sourceNode.data as FlowBaseNodeData;
  let dataType: string | null = null;

  if (pendingConnectStart.handleType === 'source') {
    const port = nd.outputs?.find(
      (p) => p.id === pendingConnectStart!.handleId,
    );
    dataType = port?.dataType ?? null;
  } else {
    const port = nd.inputs?.find(
      (p) => p.id === pendingConnectStart!.handleId,
    );
    dataType = port?.dataType ?? null;
  }

  const clientX = 'clientX' in mouseEv ? mouseEv.clientX : 0;
  const clientY = 'clientY' in mouseEv ? mouseEv.clientY : 0;

  showContextMenu(
    clientX,
    clientY,
    { ...pendingConnectStart },
    dataType,
  );
  pendingConnectStart = null;
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
        @pane-context-menu="onPaneContextMenu"
        @connect-start="onConnectStart"
        @connect-end="onConnectEnd"
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
        <template #node-imageGen="imageGenProps">
          <ImageGenFlowNode v-bind="imageGenProps" />
        </template>
        <Background :gap="16" pattern-color="var(--flow-divider, #e5e5e5)" />
        <!-- 视图控制：见 https://vueflow.dev/guide/components/controls.html -->
        <Controls
          position="top-right"
          class="flow-workspace-controls-bar nodrag"
        >
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

      <!-- 右键 / 拖线松开：节点创建菜单 -->
      <Teleport to="body">
        <div
          v-if="ctxMenu.show"
          class="flow-ctx-backdrop"
          @click="hideContextMenu"
          @contextmenu.prevent="hideContextMenu"
        />
        <div
          v-if="ctxMenu.show"
          class="flow-ctx-menu"
          :style="{
            ...flowThemeCssVars,
            left: ctxMenu.x + 'px',
            top: ctxMenu.y + 'px',
          }"
        >
          <div class="flow-ctx-menu__header">
            {{ ctxMenu.filterDataType ? `添加节点 (${ctxMenu.filterDataType})` : '添加节点' }}
          </div>
          <div
            v-if="filteredNodeDefs.length === 0"
            class="flow-ctx-menu__empty"
          >
            无匹配节点
          </div>
          <div
            v-for="def in filteredNodeDefs"
            :key="def.id"
            class="flow-ctx-menu__item"
            @click="onCtxMenuSelect(def)"
          >
            <span class="flow-ctx-item-name">{{ def.name }}</span>
            <span class="flow-ctx-item-cat">{{ def.category }}</span>
          </div>
        </div>
      </Teleport>
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

/* ── 右键上下文菜单 ── */
.flow-ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.flow-ctx-menu {
  position: fixed;
  z-index: 9999;
  min-width: 180px;
  max-width: 280px;
  max-height: 320px;
  overflow-y: auto;
  border-radius: 6px;
  border: 1px solid var(--flow-border, #e0e0e0);
  background: var(--flow-embedded, #fff);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  font-size: 12px;
  color: var(--flow-text, #333);
  user-select: none;
}

.theme-dark .flow-ctx-menu {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.flow-ctx-menu__header {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--flow-text-muted, rgba(0, 0, 0, 0.45));
  border-bottom: 1px solid var(--flow-divider, #e5e5e5);
}

.flow-ctx-menu__empty {
  padding: 12px;
  text-align: center;
  font-size: 11px;
  color: var(--flow-text-muted, rgba(0, 0, 0, 0.35));
}

.flow-ctx-menu__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.12s;
}

.flow-ctx-menu__item:hover {
  background: var(--flow-header, rgba(0, 0, 0, 0.06));
}

.flow-ctx-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-ctx-item-cat {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--flow-divider, #e5e5e5);
  color: var(--flow-text-muted, rgba(0, 0, 0, 0.55));
}
</style>
