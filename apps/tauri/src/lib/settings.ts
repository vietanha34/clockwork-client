import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  jiraToken: '',
  clockworkApiToken: '',
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    return await invoke<AppSettings>('get_settings');
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function persistSettings(settings: AppSettings): Promise<void> {
  console.log('persistSettings called with:', settings);
  // @ts-ignore
  if (typeof window !== 'undefined' && !window.__TAURI_INTERNALS__) {
    console.error('Tauri API not found. If you are in a browser, this is expected.');
    throw new Error('Tauri API not found. Please use the application window, not a browser.');
  }
  try {
    await invoke('save_settings', { settings });
    console.log('persistSettings success');
  } catch (err) {
    console.error('persistSettings invoke error:', err);
    throw err;
  }
}
