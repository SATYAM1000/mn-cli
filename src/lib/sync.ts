import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { loadConfig } from './config.js';
import { syncWithRemote } from '../utils/git.js';

export async function autoSync(operation: string): Promise<void> {
  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, '.notes');
    const configPath = path.join(notesPath, 'config.json');

    // Load config
    const config = await loadConfig(configPath);

    if (!config) {
      return; // No config, skip sync
    }

    // Check if git sync is enabled and auto-sync is on
    if (!config.sync?.git?.enabled || !config.sync?.git?.autoSync) {
      return; // Sync not enabled or auto-sync is off
    }

    const { remoteUrl, branch } = config.sync.git;

    if (!remoteUrl || !branch) {
      return; // Missing sync configuration
    }

    console.log(chalk.gray('\n🔄 Syncing with remote...'));

    const commitMessage = `${operation} - ${new Date().toISOString()}`;

    const result = await syncWithRemote(notesPath, commitMessage, branch);

    if (result.committed || result.pushed) {
      console.log(chalk.green('✓ Synced successfully!'));
      if (result.pulled) console.log(chalk.gray('  • Pulled remote changes'));
      if (result.committed) console.log(chalk.gray('  • Committed local changes'));
      if (result.pushed) console.log(chalk.gray('  • Pushed to remote'));
    } else {
      console.log(chalk.gray('✓ Already up to date'));
    }

  } catch (error) {
    console.log(chalk.yellow('\n⚠ Sync failed:'), error instanceof Error ? error.message : 'Unknown error');
    console.log(chalk.gray('Your changes are saved locally. Run'), chalk.cyan('mn sync'), chalk.gray('to try again.'));
  }
}

export async function isSyncEnabled(): Promise<boolean> {
  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, '.notes');
    const configPath = path.join(notesPath, 'config.json');

    const config = await loadConfig(configPath);
    return config?.sync?.git?.enabled ?? false;
  } catch (error) {
    return false;
  }
}
