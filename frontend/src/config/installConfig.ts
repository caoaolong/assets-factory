import { isWailsRuntime } from '../theme/applyTheme';
import {
  ReadNodesJSON,
  ReadProfileJSON,
  ReadSettingsJSON,
  WriteNodesJSON,
  WriteProfileJSON,
  WriteSettingsJSON,
} from '../../wailsjs/go/main/App.js';

const DEV_LS_SETTINGS = 'assets-factory.dev.settings';
const DEV_LS_PROFILE = 'assets-factory.dev.profile';
const DEV_LS_NODES = 'assets-factory.dev.nodes';

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

export async function readNodesJSONRaw(): Promise<string> {
  if (isWailsRuntime()) {
    const s = await ReadNodesJSON();
    return s && s.trim() !== '' ? s : '';
  }
  return localStorage.getItem(DEV_LS_NODES) ?? '';
}

export async function writeNodesJSONRaw(json: string): Promise<void> {
  if (isWailsRuntime()) {
    await WriteNodesJSON(json);
  } else {
    localStorage.setItem(DEV_LS_NODES, json);
  }
}
