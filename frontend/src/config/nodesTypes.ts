/** nodes.json：节点定义列表 */

export type NodeCategory = '创作' | '预览' | '加工' | '合并' | '拆分';

export const NODE_CATEGORIES: NodeCategory[] = [
  '创作',
  '预览',
  '加工',
  '合并',
  '拆分',
];

export interface NodeIOParam {
  name: string;
}

export interface NodeDefinition {
  id: string;
  name: string;
  /** 类型：创作 / 预览 / 加工 / 合并 / 拆分 */
  category: NodeCategory;
  description: string;
  inputs: NodeIOParam[];
  outputs: NodeIOParam[];
}

export interface NodesDocument {
  nodes: NodeDefinition[];
}

function normalizeParam(x: unknown): NodeIOParam {
  if (!x || typeof x !== 'object') {
    return {name: ''};
  }
  const o = x as Record<string, unknown>;
  return {
    name: typeof o.name === 'string' ? o.name : '',
  };
}

function isCategory(s: string): s is NodeCategory {
  return (NODE_CATEGORIES as readonly string[]).includes(s);
}

function normalizeNode(x: unknown, idx: number): NodeDefinition {
  if (!x || typeof x !== 'object') {
    return {
      id: `node-${idx}`,
      name: '',
      category: '创作',
      description: '',
      inputs: [],
      outputs: [],
    };
  }
  const o = x as Record<string, unknown>;
  const id =
    typeof o.id === 'string' && o.id
      ? o.id
      : `node-${idx}-${Date.now().toString(36)}`;
  const catRaw = typeof o.category === 'string' ? o.category : '';
  const legacyType = typeof o.type === 'string' ? o.type : '';
  const catCandidate = catRaw || legacyType;
  const category: NodeCategory = isCategory(catCandidate)
    ? catCandidate
    : '创作';
  const inputsRaw = Array.isArray(o.inputs) ? o.inputs : [];
  const outputsRaw = Array.isArray(o.outputs) ? o.outputs : [];
  return {
    id,
    name: typeof o.name === 'string' ? o.name : '',
    category,
    description: typeof o.description === 'string' ? o.description : '',
    inputs: inputsRaw.map(normalizeParam),
    outputs: outputsRaw.map(normalizeParam),
  };
}

/** 内置默认：图片生成节点 */
export function defaultNodesDocument(): NodesDocument {
  return {
    nodes: [
      {
        id: 'image-generation',
        name: '图片生成',
        category: '创作',
        description:
          '根据输入的图片列表与提示词，生成输出图片列表。',
        inputs: [{name: '图片列表'}, {name: '提示词'}],
        outputs: [{name: '图片列表'}],
      },
    ],
  };
}

export function parseNodesDocument(raw: string): NodesDocument {
  const trimmed = raw.trim();
  if (!trimmed) {
    return defaultNodesDocument();
  }
  try {
    const o = JSON.parse(trimmed) as unknown;
    if (!o || typeof o !== 'object') {
      return defaultNodesDocument();
    }
    const rec = o as Record<string, unknown>;
    const arr = Array.isArray(rec.nodes) ? rec.nodes : [];
    if (arr.length === 0) {
      return defaultNodesDocument();
    }
    return {
      nodes: arr.map(normalizeNode),
    };
  } catch {
    return defaultNodesDocument();
  }
}

export function serializeNodesDocument(data: NodesDocument): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}
