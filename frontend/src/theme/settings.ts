/** 应用界面主题偏好（窗口标题栏由 Wails 另行设置） */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'assets-factory.theme';

export function loadThemePreference(): ThemePreference {
  const v = localStorage.getItem(THEME_STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') {
    return v;
  }
  return 'system';
}

export function saveThemePreference(v: ThemePreference) {
  localStorage.setItem(THEME_STORAGE_KEY, v);
}

export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemIsDark: boolean,
): 'light' | 'dark' {
  if (preference === 'light') {
    return 'light';
  }
  if (preference === 'dark') {
    return 'dark';
  }
  return systemIsDark ? 'dark' : 'light';
}
