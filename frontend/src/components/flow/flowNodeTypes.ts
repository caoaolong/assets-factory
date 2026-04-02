/**
 * 流程图节点：连接桩定义（输入 / 输出共用）
 * 每个桩需唯一 id，供连线 sourceHandle / targetHandle 使用
 */
export interface FlowPortDefinition {
  id: string;
  /** 展示用名称，缺省为 id */
  label?: string;
  /** 语义数据类型，用于展示与后续连线校验 */
  dataType: string;
  /** 连接桩颜色（任意合法 CSS 颜色） */
  color: string;
}

/**
 * 基础节点 data 形状：名称 + 输入输出桩
 * 拓展节点请使用 `interface XxxData extends FlowBaseNodeData { form: ... }`
 */
export interface FlowBaseNodeData {
  name: string;
  inputs: FlowPortDefinition[];
  outputs: FlowPortDefinition[];
}

/** 【图片生成】节点：输入桩「图片列表」+ 表单「提示词」→ 输出「图片列表」 */
export interface FlowImageGenNodeData extends FlowBaseNodeData {
  prompt: string;
}
