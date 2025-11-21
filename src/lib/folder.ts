import fs from "fs-extra";
import path from "path";
import { NoteConfig, FolderSettings } from "../types/config.js";
import { saveConfig } from "./config.js";

export async function createFolder(
  notesPath: string,
  folderName: string,
  settings: FolderSettings
): Promise<string> {
  const folderPath = path.join(notesPath, folderName);

  const exists = await fs.pathExists(folderPath);
  if (exists) {
    throw new Error(`Folder "${folderName}" already exists`);
  }

  await fs.ensureDir(folderPath);

  return folderPath;
}

export async function listFolders(notesPath: string): Promise<string[]> {
  const items = await fs.readdir(notesPath, { withFileTypes: true });

  return items
    .filter((item) => item.isDirectory() && !item.name.startsWith("."))
    .map((item) => item.name)
    .sort();
}

export async function deleteFolder(
  notesPath: string,
  folderName: string
): Promise<void> {
  const folderPath = path.join(notesPath, folderName);
  await fs.remove(folderPath);
}

export async function addFolderToConfig(
  configPath: string,
  config: NoteConfig,
  folderName: string,
  settings: FolderSettings
): Promise<void> {
  config.folderSettings[folderName] = settings;
  config.updatedAt = new Date().toISOString();
  await saveConfig(configPath, config);
}

export async function removeFolderFromConfig(
  configPath: string,
  config: NoteConfig,
  folderName: string
): Promise<void> {
  delete config.folderSettings[folderName];
  config.updatedAt = new Date().toISOString();
  await saveConfig(configPath, config);
}

export async function updateFolderSettings(
  configPath: string,
  config: NoteConfig,
  folderName: string,
  settings: Partial<FolderSettings>
): Promise<void> {
  if (!config.folderSettings[folderName]) {
    throw new Error(`Folder "${folderName}" not found in config`);
  }

  config.folderSettings[folderName] = {
    ...config.folderSettings[folderName],
    ...settings,
  };
  config.updatedAt = new Date().toISOString();
  await saveConfig(configPath, config);
}

export function sanitizeFolderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}
