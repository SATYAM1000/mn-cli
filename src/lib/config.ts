import fs from "fs-extra";
import path from "path";
import { NoteConfig } from "../types/config";

export async function saveConfig(
  configPath: string,
  config: NoteConfig
): Promise<void> {
  await fs.writeJson(configPath, config, { spaces: 2 });
}

export async function loadConfig(
  configPath: string
): Promise<NoteConfig | null> {
  try {
    const exists = await fs.pathExists(configPath);
    if (!exists) return null;
    const config = await fs.readJson(configPath);
    return config as NoteConfig;
  } catch (error) {
    return null;
  }
}

export function createDefaultConfig(notesPath: string): NoteConfig {
  const now = new Date().toISOString();

  return {
    version: "1.0.0",
    notesPath,
    folderSettings: {
      general: { encrypted: false, gitIgnored: false },
      security: { encrypted: true, gitIgnored: true },
    },
    createdAt: now,
    updatedAt: now,
  };
}
