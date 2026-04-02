<script lang="ts">
export default {
  inheritAttrs: false,
};
</script>

<script lang="ts" setup>
import type {NodeProps} from '@vue-flow/core';
import {NInput} from 'naive-ui';
import BaseFlowNode from './BaseFlowNode.vue';
import type {FlowImageGenNodeData} from './flowNodeTypes';

const props = defineProps<NodeProps<FlowImageGenNodeData>>();
</script>

<template>
  <BaseFlowNode v-bind="props">
    <template #form>
      <div class="image-gen-form">
        <p class="image-gen-hint muted">
          左侧连接「图片列表」；输出至右侧桩。
        </p>
        <label class="image-gen-label">提示词</label>
        <NInput
          v-model:value="props.data.prompt"
          type="textarea"
          placeholder="描述期望生成的画面…"
          :autosize="{ minRows: 2, maxRows: 6 }"
          size="small"
          class="image-gen-prompt"
        />
      </div>
    </template>
  </BaseFlowNode>
</template>

<style scoped>
.image-gen-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.image-gen-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
}

.image-gen-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--flow-text-muted, rgba(0, 0, 0, 0.45));
}

.image-gen-prompt {
  font-size: 12px;
}

.image-gen-prompt :deep(textarea) {
  font-size: 12px;
  line-height: 1.45;
}
</style>
