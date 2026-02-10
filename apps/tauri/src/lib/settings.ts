import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  userEmail: "",
  apiBaseUrl: "",
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    return await invoke<AppSettings>("get_settings");
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function persistSettings(settings: AppSettings): Promise<void> {
  await invoke("save_settings", { settings });
}
