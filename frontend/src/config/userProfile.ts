import type {ThemePreference} from '../theme/settings';
import {THEME_STORAGE_KEY} from '../theme/settings';
import {readProfileJSONRaw, writeProfileJSONRaw} from './installConfig';

export interface UserProfileData {
  theme: ThemePreference;
}

const defaultProfile = (): UserProfileData => ({theme: 'system'});

function parseUserProfile(raw: string): UserProfileData {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') {
      return defaultProfile();
    }
    const t = (o as Record<string, unknown>).theme;
    if (t === 'light' || t === 'dark' || t === 'system') {
      return {theme: t};
    }
    return defaultProfile();
  } catch {
    return defaultProfile();
  }
}

/** 从 profile.json（或浏览器本地回退）加载首选项；若无文件则从原 localStorage 主题键迁移一次 */
export async function loadUserProfile(): Promise<UserProfileData> {
  const raw = await readProfileJSONRaw();
  if (!raw.trim()) {
    const legacy = localStorage.getItem(THEME_STORAGE_KEY);
    const theme: ThemePreference =
      legacy === 'light' || legacy === 'dark' || legacy === 'system'
        ? legacy
        : 'system';
    const initial = {theme};
    await writeProfileJSONRaw(`${JSON.stringify(initial, null, 2)}\n`);
    return initial;
  }
  return parseUserProfile(raw);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSaveUserProfile(data: UserProfileData): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void writeProfileJSONRaw(`${JSON.stringify(data, null, 2)}\n`);
  }, 320);
}

/** 立即写入 profile.json，并取消未执行的防抖保存 */
export async function saveUserProfileImmediate(
  data: UserProfileData,
): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await writeProfileJSONRaw(`${JSON.stringify(data, null, 2)}\n`);
}
