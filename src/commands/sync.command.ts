import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { input, confirm } from '@inquirer/prompts';
import ora from 'ora';
import { loadConfig, saveConfig } from '../lib/config.js';
import { syncWithRemote, checkGitInstalled, initGitRepo, setupRemote, createInitialCommit } from '../utils/git.js';

export async function syncCommand() {
  const spinner = ora();

  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, '.notes');
    const configPath = path.join(notesPath, 'config.json');

    // Check if notes is initialized
    const config = await loadConfig(configPath);

    if (!config) {
      console.log(chalk.red('✖ Notes not initialized.'));
      console.log(chalk.yellow('Run'), chalk.cyan('mn init'), chalk.yellow('first.'));
      process.exit(1);
    }

    // Check if git sync is configured
    if (!config.sync?.git?.enabled) {
      console.log(chalk.yellow('✖ Git sync is not configured.'));
      console.log(chalk.gray('Run'), chalk.cyan('mn sync setup'), chalk.gray('to configure it.'));
      return;
    }

    const { remoteUrl, branch } = config.sync.git;

    console.log(chalk.blue('Syncing with remote...'));
    console.log(chalk.gray('Remote: ') + chalk.cyan(remoteUrl));
    console.log(chalk.gray('Branch: ') + chalk.cyan(branch));

    spinner.start('Syncing...');

    const commitMessage = `Manual sync - ${new Date().toISOString()}`;
    const result = await syncWithRemote(notesPath, commitMessage, branch);

    spinner.succeed('Sync completed!');

    console.log(chalk.green('\n✓ Sync successful!\n'));

    if (result.pulled) {
      console.log(chalk.gray('  • ') + chalk.white('Pulled changes from remote'));
    }

    if (result.committed) {
      console.log(chalk.gray('  • ') + chalk.white('Committed local changes'));
    }

    if (result.pushed) {
      console.log(chalk.gray('  • ') + chalk.white('Pushed changes to remote'));
    }

    if (!result.committed && !result.pushed && !result.pulled) {
      console.log(chalk.gray('  • ') + chalk.white('Already up to date'));
    }

  } catch (error) {
    spinner.fail('Sync failed');
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    console.log(chalk.yellow('\nTroubleshooting:'));
    console.log(chalk.gray('  • Make sure you have push access to the remote repository'));
    console.log(chalk.gray('  • Check your internet connection'));
    console.log(chalk.gray('  • Verify the remote URL is correct with'), chalk.cyan('mn sync status'));
    process.exit(1);
  }
}

export async function syncSetupCommand() {
  const spinner = ora();

  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, '.notes');
    const configPath = path.join(notesPath, 'config.json');

    // Check if notes is initialized
    const config = await loadConfig(configPath);

    if (!config) {
      console.log(chalk.red('✖ Notes not initialized.'));
      console.log(chalk.yellow('Run'), chalk.cyan('mn init'), chalk.yellow('first.'));
      process.exit(1);
    }

    console.log(chalk.blue('Git sync setup:\n'));

    // Check if git is installed
    const gitInstalled = await checkGitInstalled();

    if (!gitInstalled) {
      console.log(chalk.red('✖ Git is not installed on your system.'));
      console.log(chalk.yellow('Please install Git first.'));
      process.exit(1);
    }

    // Initialize git repository if not already
    spinner.start('Initializing Git repository...');
    await initGitRepo(notesPath);
    spinner.succeed('Git repository initialized!');

    // Ask for remote URL
    const remoteUrl = await input({
      message: 'Enter your GitHub repository URL (e.g., https://github.com/user/repo.git):',
      default: config.sync?.git?.remoteUrl,
      validate: (value) => {
        if (!value.trim()) return 'Remote URL cannot be empty';
        // Remove any git command prefix if user accidentally included it
        const cleanValue = value.replace(/^git\s+remote\s+add\s+\w+\s+/, '').trim();
        if (!cleanValue.includes('github.com')) return 'Please provide a valid GitHub URL';
        if (cleanValue.startsWith('git remote')) return 'Please enter only the URL, not the git command';
        return true;
      },
      transformer: (value) => {
        // Clean up the URL if user entered git command
        return value.replace(/^git\s+remote\s+add\s+\w+\s+/, '').trim();
      },
    });

    // Ask for branch name
    const branch = await input({
      message: 'Enter branch name:',
      default: config.sync?.git?.branch || 'main',
    });

    // Ask for auto-sync
    const autoSync = await confirm({
      message: 'Enable automatic sync after every operation?',
      default: config.sync?.git?.autoSync ?? true,
    });

    // Setup remote
    spinner.start('Setting up remote...');
    await setupRemote(notesPath, remoteUrl);
    spinner.succeed('Remote configured!');

    // Create initial commit if needed
    spinner.start('Checking repository status...');
    await createInitialCommit(notesPath, branch);
    spinner.succeed('Repository ready!');

    // Update config
    config.sync = {
      enabled: true,
      provider: 'git',
      git: {
        enabled: true,
        remoteUrl,
        branch,
        autoSync,
      },
    };

    await saveConfig(configPath, config);

    console.log(chalk.green('\n✓ Git sync configured!\n'));
    console.log(chalk.gray('Remote: ') + chalk.cyan(remoteUrl));
    console.log(chalk.gray('Branch: ') + chalk.cyan(branch));
    console.log(chalk.gray('Auto-sync: ') + chalk.cyan(autoSync ? 'Enabled' : 'Disabled'));

    // Ask if user wants to sync now
    const syncNow = await confirm({
      message: 'Do you want to sync now?',
      default: true,
    });

    if (syncNow) {
      console.log(chalk.blue('\nSyncing with remote...'));
      await syncCommand();
    }

  } catch (error) {
    spinner.fail('Setup failed');
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

export async function syncStatusCommand() {
  const spinner = ora();

  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, '.notes');
    const configPath = path.join(notesPath, 'config.json');

    // Check if notes is initialized
    const config = await loadConfig(configPath);

    if (!config) {
      console.log(chalk.red('✖ Notes not initialized.'));
      console.log(chalk.yellow('Run'), chalk.cyan('mn init'), chalk.yellow('first.'));
      process.exit(1);
    }

    console.log(chalk.blue('Git sync status:\n'));

    if (!config.sync?.git?.enabled) {
      console.log(chalk.yellow('Status: ') + chalk.red('Not configured'));
      console.log(chalk.gray('\nRun'), chalk.cyan('mn sync setup'), chalk.gray('to configure Git sync.'));
      return;
    }

    console.log(chalk.gray('Status: ') + chalk.green('Configured'));
    console.log(chalk.gray('Remote: ') + chalk.cyan(config.sync.git.remoteUrl));
    console.log(chalk.gray('Branch: ') + chalk.cyan(config.sync.git.branch));
    console.log(chalk.gray('Auto-sync: ') + chalk.cyan(config.sync.git.autoSync ? 'Enabled' : 'Disabled'));

    // Check git status
    spinner.start('Checking repository status...');
    const simpleGit = require('simple-git').simpleGit;
    const git = simpleGit(notesPath);

    try {
      const status = await git.status();
      spinner.stop();

      console.log(chalk.gray('\nLocal changes:'));

      if (status.files.length === 0) {
        console.log(chalk.gray('  • ') + chalk.green('No uncommitted changes'));
      } else {
        console.log(chalk.gray('  • ') + chalk.yellow(`${status.files.length} uncommitted file(s)`));
      }

      if (status.ahead > 0) {
        console.log(chalk.gray('  • ') + chalk.yellow(`${status.ahead} commit(s) ahead of remote`));
      }

      if (status.behind > 0) {
        console.log(chalk.gray('  • ') + chalk.yellow(`${status.behind} commit(s) behind remote`));
      }

      if (status.ahead === 0 && status.behind === 0 && status.files.length === 0) {
        console.log(chalk.gray('  • ') + chalk.green('In sync with remote'));
      }

    } catch (error) {
      spinner.stop();
      console.log(chalk.gray('\nLocal changes: ') + chalk.yellow('Unable to check'));
    }

  } catch (error) {
    spinner.fail('Failed to get status');
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

export async function syncDisableCommand() {
  const spinner = ora();

  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, '.notes');
    const configPath = path.join(notesPath, 'config.json');

    // Check if notes is initialized
    const config = await loadConfig(configPath);

    if (!config) {
      console.log(chalk.red('✖ Notes not initialized.'));
      console.log(chalk.yellow('Run'), chalk.cyan('mn init'), chalk.yellow('first.'));
      process.exit(1);
    }

    if (!config.sync?.git?.enabled) {
      console.log(chalk.yellow('Git sync is already disabled.'));
      return;
    }

    const confirmDisable = await confirm({
      message: 'Are you sure you want to disable Git sync?',
      default: false,
    });

    if (!confirmDisable) {
      console.log(chalk.yellow('Cancelled.'));
      return;
    }

    // Disable sync
    if (config.sync?.git) {
      config.sync.git.enabled = false;
      config.sync.git.autoSync = false;
    }

    await saveConfig(configPath, config);

    console.log(chalk.green('\n✓ Git sync disabled.'));
    console.log(chalk.gray('Your notes are still tracked by Git locally.'));
    console.log(chalk.gray('Run'), chalk.cyan('mn sync setup'), chalk.gray('to enable sync again.'));

  } catch (error) {
    spinner.fail('Failed to disable sync');
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
