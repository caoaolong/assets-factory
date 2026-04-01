<script lang="ts">
export default {
  inheritAttrs: false,
};
</script>

<script lang="ts" setup>
import type { NodeProps } from '@vue-flow/core';
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import { NodeToolbar } from '@vue-flow/node-toolbar';
import { TrashOutline } from '@vicons/ionicons5';
import { NButton, NIcon, NTooltip } from 'naive-ui';
import { computed } from 'vue';
import type { FlowBaseNodeData } from './flowNodeTypes';

const props = defineProps<NodeProps<FlowBaseNodeData>>();
const { removeNodes } = useVueFlow();

const displayName = computed(() => props.data.name?.trim() || '未命名');
const inputs = computed(() => props.data.inputs ?? []);
const outputs = computed(() => props.data.outputs ?? []);

/** 删除当前节点并移除相连边（与 Vue Flow Node Toolbar 配合） */
function onToolbarDelete() {
  removeNodes([props.id], true);
}
</script>

<template>
  <NodeToolbar
    :is-visible="selected"
    :position="Position.Top"
    :offset="10"
  >
    <div class="flow-node-toolbar nodrag">
      <NButton
        quaternary
        circle
        size="small"
        type="error"
        aria-label="删除节点"
        @click.stop="onToolbarDelete"
      >
        <template #icon>
          <NIcon :component="TrashOutline" />
        </template>
      </NButton>
    </div>
  </NodeToolbar>

  <div
    class="flow-base-node"
    :class="{ 'flow-base-node--selected': selected }"
  >
    <header class="flow-base-node__header">
      <span class="flow-base-node__title">{{ displayName }}</span>
    </header>

    <div class="flow-base-node__body">
      <aside class="flow-base-node__ports flow-base-node__ports--in">
        <div
          v-for="port in inputs"
          :key="`in-${port.id}`"
          class="flow-port flow-port--in"
        >
          <NTooltip placement="left" :delay="200">
            <template #trigger>
              <span
                class="flow-port-handle-wrap"
                :aria-label="port.dataType"
              >
                <Handle
                  :id="port.id"
                  type="target"
                  :position="Position.Left"
                  :connectable="connectable"
                  class="flow-base-handle"
                  :style="{
                    background: port.color,
                    borderColor: port.color,
                  }"
                />
              </span>
            </template>
            {{ port.dataType }}
          </NTooltip>
        </div>
      </aside>

      <!-- nodrag：在表单内操作时不触发画布拖节点 -->
      <div class="flow-base-node__form nodrag">
        <slot name="form" />
      </div>

      <aside class="flow-base-node__ports flow-base-node__ports--out">
        <div
          v-for="port in outputs"
          :key="`out-${port.id}`"
          class="flow-port flow-port--out"
        >
          <NTooltip placement="right" :delay="200">
            <template #trigger>
              <span
                class="flow-port-handle-wrap"
                :aria-label="port.dataType"
              >
                <Handle
                  :id="port.id"
                  type="source"
                  :position="Position.Right"
                  :connectable="connectable"
                  class="flow-base-handle"
                  :style="{
                    background: port.color,
                    borderColor: port.color,
                  }"
                />
              </span>
            </template>
            {{ port.dataType }}
          </NTooltip>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.flow-base-node {
  position: relative;
  min-width: 180px;
  max-width: 360px;
  border-radius: 8px;
  border: 1px solid var(--flow-border, #e0e0e0);
  background: var(--flow-embedded, #fff);
  /* --flow-node-shadow 由 WorkspaceView .flow-canvas 按亮/暗主题注入 */
  box-shadow: var(
    --flow-node-shadow,
    0 2px 8px rgba(0, 0, 0, 0.2)
  );
  font-size: 12px;
  color: var(--flow-text, rgba(0, 0, 0, 0.82));
}

.flow-base-node--selected {
  border-color: var(--flow-primary, #18a058);
  box-shadow: 0 0 0 1px var(--flow-primary, #18a058);
}

.flow-base-node__header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--flow-divider, #e5e5e5);
  background: var(--flow-header, rgba(0, 0, 0, 0.04));
}

.flow-base-node__title {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.flow-base-node__body {
  display: flex;
  align-items: stretch;
  gap: 0;
  min-height: 48px;
}

.flow-base-node__ports {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 8px 0;
  flex-shrink: 0;
}

.flow-base-node__ports--in {
  padding-left: 8px;
  padding-right: 2px;
}

.flow-base-node__ports--out {
  padding-right: 8px;
  padding-left: 2px;
}

.flow-base-node__form {
  flex: 1;
  min-width: 0;
  padding: 10px 8px;
  border-left: 1px solid var(--flow-divider, #e8e8e8);
  border-right: 1px solid var(--flow-divider, #e8e8e8);
}

.flow-port {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
}

.flow-port--out {
  justify-content: center;
}

.flow-port-handle-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

/* 连接桩：在侧栏内相对行定位，避免重叠 */
:deep(.flow-base-handle) {
  position: relative;
  transform: none;
  top: auto;
  left: auto;
  right: auto;
  width: 10px;
  height: 10px;
  border-width: 2px;
  flex-shrink: 0;
}

.flow-port--in :deep(.flow-base-handle) {
  margin-left: -4px;
}

.flow-port--out :deep(.flow-base-handle) {
  margin-right: -4px;
}

.flow-node-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 8px;
  border: 1px solid var(--flow-border, #e0e0e0);
  background: var(--flow-embedded, #fff);
  box-shadow: var(
    --flow-node-toolbar-shadow,
    0 2px 10px rgba(0, 0, 0, 0.25)
  );
}
</style>
