import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export async function initGitRepo(repoPath: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check if already a git repo
  const isRepo = await git.checkIsRepo();

  if (!isRepo) {
    await git.init();
  }
}

export async function setupRemote(
  repoPath: string,
  remoteUrl: string,
  remoteName: string = 'origin'
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check if remote already exists
  const remotes = await git.getRemotes();
  const existingRemote = remotes.find(r => r.name === remoteName);

  if (existingRemote) {
    // Update remote URL
    await git.removeRemote(remoteName);
  }

  await git.addRemote(remoteName, remoteUrl);
}

export async function commitChanges(
  repoPath: string,
  message: string
): Promise<boolean> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check if there are changes
  const status = await git.status();

  if (status.files.length === 0) {
    return false; // No changes to commit
  }

  // Add all changes
  await git.add('.');

  // Commit
  await git.commit(message);

  return true;
}

export async function pushToRemote(
  repoPath: string,
  branch: string = 'main',
  remoteName: string = 'origin'
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.push(remoteName, branch, ['--set-upstream']);
  } catch (error) {
    // If push fails, might need to pull first
    throw error;
  }
}

export async function pullFromRemote(
  repoPath: string,
  branch: string = 'main',
  remoteName: string = 'origin'
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    await git.pull(remoteName, branch);
  } catch (error) {
    throw error;
  }
}

export async function syncWithRemote(
  repoPath: string,
  commitMessage: string,
  branch: string = 'main',
  remoteName: string = 'origin'
): Promise<{ committed: boolean; pushed: boolean; pulled: boolean }> {
  const git: SimpleGit = simpleGit(repoPath);

  let committed = false;
  let pushed = false;
  let pulled = false;

  try {
    // First, try to pull changes from remote
    try {
      await git.pull(remoteName, branch, { '--rebase': 'true' });
      pulled = true;
    } catch (pullError) {
      // If pull fails (maybe first push), continue
      console.log(chalk.gray('No remote changes to pull'));
    }

    // Check if there are local changes
    const status = await git.status();

    if (status.files.length > 0) {
      // Add and commit changes
      await git.add('.');
      await git.commit(commitMessage);
      committed = true;
    }

    // Push to remote
    try {
      await git.push(remoteName, branch, ['--set-upstream']);
      pushed = true;
    } catch (pushError) {
      // If push fails, might be first push or conflicts
      throw pushError;
    }

  } catch (error) {
    throw error;
  }

  return { committed, pushed, pulled };
}

export async function checkGitInstalled(): Promise<boolean> {
  try {
    const git: SimpleGit = simpleGit();
    await git.version();
    return true;
  } catch (error) {
    return false;
  }
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);
  const status = await git.status();
  return status.current || 'main';
}

export async function createInitialCommit(repoPath: string, branch: string = 'main'): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check if there's already a commit
  try {
    await git.log();
    // If log succeeds, there are commits
    // Make sure we're on the correct branch
    const currentBranch = await getCurrentBranch(repoPath);
    if (currentBranch !== branch) {
      // Try to checkout existing branch or create new one
      try {
        await git.checkout(branch);
      } catch (error) {
        await git.checkoutLocalBranch(branch);
      }
    }
    return;
  } catch (error) {
    // No commits yet, create initial commit
    await git.add('.');
    await git.commit('Initial commit: Setup notes directory');

    // Rename branch to the desired name (handles master -> main rename)
    try {
      await git.branch(['-M', branch]);
    } catch (error) {
      // Branch already named correctly or error
    }
  }
}

export async function hasRemote(repoPath: string, remoteName: string = 'origin'): Promise<boolean> {
  const git: SimpleGit = simpleGit(repoPath);
  const remotes = await git.getRemotes();
  return remotes.some(r => r.name === remoteName);
}
