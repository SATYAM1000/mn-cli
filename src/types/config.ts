export interface FolderSettings {
  encrypted: boolean;
  gitIgnored: boolean;
}

export interface SyncSettings {
  enabled: boolean;
  provider?: "git" | "dropbox" | "gdrive";
  remotePath?: string;
}

export interface NoteConfig {
  version: string;
  notesPath: string;
  defaultEditor?: string;
  folderSettings: {
    [folderName: string]: FolderSettings;
  };
  sync?: SyncSettings;
  createdAt: string;
  updatedAt: string;
}
