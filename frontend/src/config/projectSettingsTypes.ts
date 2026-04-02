/** settings.json：项目级配置（Dashscope API Key） */

export interface ProjectSettingsData {
  dashscopeApiKey: string;
}

export function defaultProjectSettings(): ProjectSettingsData {
  return {dashscopeApiKey: ''};
}

function apiKeyFromProvider(o: Record<string, unknown>): string {
  return typeof o.apiKey === 'string' ? o.apiKey : '';
}

/** 从旧版 modelProviders 尽量取出 Dashscope 相关 Key */
function migrateFromModelProviders(raw: unknown[]): string {
  for (const x of raw) {
    if (!x || typeof x !== 'object') {
      continue;
    }
    const o = x as Record<string, unknown>;
    const name = (typeof o.name === 'string' ? o.name : '').toLowerCase();
    const base = (typeof o.baseUrl === 'string' ? o.baseUrl : '').toLowerCase();
    if (
      name.includes('dashscope') ||
      base.includes('dashscope') ||
      name.includes('灵积') ||
      name.includes('通义')
    ) {
      const k = apiKeyFromProvider(o);
      if (k) {
        return k;
      }
    }
  }
  const first = raw[0];
  if (first && typeof first === 'object') {
    return apiKeyFromProvider(first as Record<string, unknown>);
  }
  return '';
}

export function parseProjectSettings(raw: string): ProjectSettingsData {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') {
      return defaultProjectSettings();
    }
    const rec = o as Record<string, unknown>;
    if (typeof rec.dashscopeApiKey === 'string') {
      return {dashscopeApiKey: rec.dashscopeApiKey};
    }
    const arr = Array.isArray(rec.modelProviders) ? rec.modelProviders : [];
    return {dashscopeApiKey: migrateFromModelProviders(arr)};
  } catch {
    return defaultProjectSettings();
  }
}

export function serializeProjectSettings(data: ProjectSettingsData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}
