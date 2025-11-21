export interface FolderSettings {
  encrypted: boolean;
  gitIgnored: boolean;
}

export interface GitSyncSettings {
  enabled: boolean;
  remoteUrl: string;
  branch: string;
  autoSync: boolean;
}

export interface SyncSettings {
  enabled: boolean;
  provider?: "git" | "dropbox" | "gdrive";
  remotePath?: string;
  git?: GitSyncSettings;
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
