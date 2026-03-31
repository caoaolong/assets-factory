import type { ThemePreference } from './settings';
import {
  WindowSetDarkTheme,
  WindowSetLightTheme,
  WindowSetSystemDefaultTheme,
} from '../../wailsjs/runtime/runtime.js';

/** 是否在 Wails WebView 内（浏览器纯前端调试时为 false） */
export function isWailsRuntime(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { runtime?: unknown }).runtime;
}

/**
 * 同步原生窗口框架亮暗（标题栏、边框等）。
 * 注意：在 Windows 上，Wails 使用的 DWM「沉浸式暗色」通常不会作用于传统 HMENU
 * 菜单条（文件/编辑那一行），该条仍由系统用浅色绘制——这是系统与 Wails 的已知限制，
 * 与是否调用本函数无关；页面内 Vue 主题不受影响。
 */
export function applyWailsWindowChrome(preference: ThemePreference) {
  if (!isWailsRuntime()) {
    return;
  }
  try {
    if (preference === 'system') {
      WindowSetSystemDefaultTheme();
    } else if (preference === 'light') {
      WindowSetLightTheme();
    } else {
      WindowSetDarkTheme();
    }
  } catch {
    /* 忽略 devtools 或非宿主环境 */
  }
}

/** 根节点 class / color-scheme，供全局与大块布局使用 */
export function applyDocumentTheme(effective: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add(effective === 'light' ? 'theme-light' : 'theme-dark');
  root.style.colorScheme = effective === 'light' ? 'light' : 'dark';
}
