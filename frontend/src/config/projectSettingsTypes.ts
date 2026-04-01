/** settings.json：项目级配置（模型提供方等） */

export interface ModelEntry {
  name: string;
  code: string;
}

export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: ModelEntry[];
}

export interface ProjectSettingsData {
  modelProviders: ModelProvider[];
}

export function defaultProjectSettings(): ProjectSettingsData {
  return {modelProviders: []};
}

function normalizeModelEntry(x: unknown): ModelEntry {
  if (!x || typeof x !== 'object') {
    return {name: '', code: ''};
  }
  const o = x as Record<string, unknown>;
  return {
    name: typeof o.name === 'string' ? o.name : '',
    code: typeof o.code === 'string' ? o.code : '',
  };
}

function normalizeProvider(x: unknown, idx: number): ModelProvider {
  if (!x || typeof x !== 'object') {
    return {
      id: `provider-${idx}`,
      name: '',
      baseUrl: '',
      apiKey: '',
      models: [],
    };
  }
  const o = x as Record<string, unknown>;
  const id =
    typeof o.id === 'string' && o.id
      ? o.id
      : `provider-${idx}-${Date.now().toString(36)}`;
  const modelsRaw = Array.isArray(o.models) ? o.models : [];
  return {
    id,
    name: typeof o.name === 'string' ? o.name : '',
    baseUrl: typeof o.baseUrl === 'string' ? o.baseUrl : '',
    apiKey: typeof o.apiKey === 'string' ? o.apiKey : '',
    models: modelsRaw.map(normalizeModelEntry),
  };
}

export function parseProjectSettings(raw: string): ProjectSettingsData {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') {
      return defaultProjectSettings();
    }
    const rec = o as Record<string, unknown>;
    const arr = Array.isArray(rec.modelProviders) ? rec.modelProviders : [];
    return {
      modelProviders: arr.map(normalizeProvider),
    };
  } catch {
    return defaultProjectSettings();
  }
}

export function serializeProjectSettings(data: ProjectSettingsData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}
