import { isWailsRuntime } from '../theme/applyTheme';
import {
  ReadProfileJSON,
  ReadSettingsJSON,
  WriteProfileJSON,
  WriteSettingsJSON,
} from '../../wailsjs/go/main/App.js';

const DEV_LS_SETTINGS = 'assets-factory.dev.settings';
const DEV_LS_PROFILE = 'assets-factory.dev.profile';

export async function readSettingsJSONRaw(): Promise<string> {
  if (isWailsRuntime()) {
    const s = await ReadSettingsJSON();
    return s && s.trim() !== '' ? s : '{}';
  }
  return localStorage.getItem(DEV_LS_SETTINGS) ?? '{}';
}

export async function writeSettingsJSONRaw(json: string): Promise<void> {
  if (isWailsRuntime()) {
    await WriteSettingsJSON(json);
  } else {
    localStorage.setItem(DEV_LS_SETTINGS, json);
  }
}

export async function readProfileJSONRaw(): Promise<string> {
  if (isWailsRuntime()) {
    const s = await ReadProfileJSON();
    return s && s.trim() !== '' ? s : '';
  }
  return localStorage.getItem(DEV_LS_PROFILE) ?? '';
}

export async function writeProfileJSONRaw(json: string): Promise<void> {
  if (isWailsRuntime()) {
    await WriteProfileJSON(json);
  } else {
    localStorage.setItem(DEV_LS_PROFILE, json);
  }
}
