import fs from "fs-extra";
import path from "path";
import os from "os";
import chalk from "chalk";
import { input, confirm, select } from "@inquirer/prompts";
import ora from "ora";

import { createDefaultConfig, saveConfig, createGitIgnore } from "../lib";
import {
  checkGitInstalled,
  initGitRepo,
  setupRemote,
  createInitialCommit,
} from "../utils/git.js";

export async function initCommand() {
  const spinner = ora();
  try {
    const homeDirectory = os.homedir();
    const notesPath = path.join(homeDirectory, ".notes");
    const configPath = path.join(notesPath, "config.json");

    console.log(
      chalk.blue("Initializing notes directory at:"),
      chalk.cyan(notesPath)
    );

    const alreadyExists = await fs.pathExists(notesPath);
    if (alreadyExists) {
      const shouldReinit = await confirm({
        message: "Notes directory already exists. Reinitialize?",
        default: false,
      });

      if (!shouldReinit) {
        console.log(chalk.yellow("Skipping reinitialization"));
        return;
      }
    }

    spinner.start("Creating notes directory structure...");
    await fs.ensureDir(notesPath);
    await fs.ensureDir(path.join(notesPath, "general"));
    await fs.ensureDir(path.join(notesPath, "security"));
    spinner.succeed("Notes directory structure created!");

    console.log(chalk.blue("\nConfiguration setup:"));
    const encryptSecurity = await confirm({
      message: 'Do you want to encrypt the "security" folder?',
      default: true,
    });

    const gitIgnoreSecurity = await confirm({
      message: 'Do you want to exclude "security" folder from git?',
      default: true,
    });

    const setEditor = await confirm({
      message: "Do you want to set a default editor?",
      default: false,
    });

    let defaultEditor: string | undefined;

    if (setEditor) {
      defaultEditor = await input({
        message: "Enter your preferred editor command (e.g., code, vim, nano):",
        default: "vim",
      });
    }

    spinner.start("Creating configuration...");

    const config = createDefaultConfig(notesPath);
    config.folderSettings.security.encrypted = encryptSecurity;
    config.folderSettings.security.gitIgnored = gitIgnoreSecurity;

    if (defaultEditor) {
      config.defaultEditor = defaultEditor;
    }

    await saveConfig(configPath, config);

    spinner.succeed("Configuration saved!");

    spinner.start("Creating gitignore...");
    const ignoredFolders: string[] = [];

    Object.entries(config.folderSettings).forEach(
      ([folderName, folderSettings]) => {
        if (folderSettings.gitIgnored) {
          ignoredFolders.push(folderName);
        }
      }
    );
    await createGitIgnore(notesPath, ignoredFolders);
    spinner.succeed("Gitignore created!");

    // Git sync setup
    console.log(chalk.blue("\nGit sync setup:"));

    const enableGitSync = await confirm({
      message: "Do you want to enable Git sync with GitHub?",
      default: false,
    });

    if (enableGitSync) {
      // Check if git is installed
      const gitInstalled = await checkGitInstalled();

      if (!gitInstalled) {
        console.log(chalk.yellow("\n⚠ Git is not installed on your system."));
        console.log(chalk.gray("Git sync will be disabled. Install Git and run ") + chalk.cyan("mn sync setup") + chalk.gray(" to enable it later."));
      } else {
        // Initialize git repository
        spinner.start("Initializing Git repository...");
        await initGitRepo(notesPath);
        spinner.succeed("Git repository initialized!");

        // Ask for remote URL
        const remoteUrl = await input({
          message: "Enter your GitHub repository URL (e.g., https://github.com/user/repo.git):",
          validate: (value) => {
            if (!value.trim()) return "Remote URL cannot be empty";
            // Remove any git command prefix if user accidentally included it
            const cleanValue = value.replace(/^git\s+remote\s+add\s+\w+\s+/, '').trim();
            if (!cleanValue.includes("github.com")) return "Please provide a valid GitHub URL";
            if (cleanValue.startsWith("git remote")) return "Please enter only the URL, not the git command";
            return true;
          },
          transformer: (value) => {
            // Clean up the URL if user entered git command
            return value.replace(/^git\s+remote\s+add\s+\w+\s+/, '').trim();
          },
        });

        // Ask for branch name
        const branch = await input({
          message: "Enter branch name:",
          default: "main",
        });

        // Ask for auto-sync
        const autoSync = await confirm({
          message: "Enable automatic sync after every operation?",
          default: true,
        });

        // Setup remote
        spinner.start("Setting up remote...");
        await setupRemote(notesPath, remoteUrl);
        spinner.succeed("Remote configured!");

        // Create initial commit
        spinner.start("Creating initial commit...");
        await createInitialCommit(notesPath, branch);
        spinner.succeed("Initial commit created!");

        // Update config with git sync settings
        config.sync = {
          enabled: true,
          provider: "git",
          git: {
            enabled: true,
            remoteUrl,
            branch,
            autoSync,
          },
        };

        await saveConfig(configPath, config);

        console.log(chalk.green("\n✓ Git sync configured!"));
        console.log(chalk.gray("  • Remote: ") + chalk.cyan(remoteUrl));
        console.log(chalk.gray("  • Branch: ") + chalk.cyan(branch));
        console.log(chalk.gray("  • Auto-sync: ") + chalk.cyan(autoSync ? "Enabled" : "Disabled"));

        // Try initial push
        console.log(chalk.blue("\nPushing to remote..."));
        try {
          spinner.start("Pushing initial commit...");
          const { pushToRemote } = await import("../utils/git.js");
          await pushToRemote(notesPath, branch);
          spinner.succeed("Pushed to remote!");
        } catch (error) {
          spinner.warn("Initial push failed");
          console.log(chalk.yellow("\n⚠ Could not push to remote. This might be because:"));
          console.log(chalk.gray("  • The repository doesn't exist yet on GitHub"));
          console.log(chalk.gray("  • You need to authenticate with GitHub"));
          console.log(chalk.gray("  • The branch name is different"));
          console.log(chalk.gray("\nRun ") + chalk.cyan("mn sync") + chalk.gray(" manually after setting up the remote repository."));
        }
      }
    }

    console.log(chalk.green("\n✓ Notes initialized successfully!\n"));
    console.log(chalk.white("Created folders:"));
    console.log(
      chalk.gray("  • ") +
        chalk.cyan("general/") +
        chalk.gray(" (not encrypted)")
    );
    console.log(
      chalk.gray("  • ") +
        chalk.cyan("security/") +
        chalk.gray(encryptSecurity ? " (encrypted)" : " (not encrypted)")
    );
    console.log(chalk.white("\nConfiguration:"));
    console.log(chalk.gray("  • Config file: ") + chalk.cyan(configPath));
    if (defaultEditor) {
      console.log(
        chalk.gray("  • Default editor: ") + chalk.cyan(defaultEditor)
      );
    }

    if (ignoredFolders.length > 0) {
      console.log(
        chalk.gray("  • Git ignored folders: ") +
          chalk.cyan(ignoredFolders.join(", "))
      );
    }

    console.log(chalk.white("\nNext steps:"));
    console.log(
      chalk.gray("  • Run") +
        chalk.yellow(" mn create ") +
        chalk.gray("to create your first note")
    );
  } catch (error) {
    spinner.fail("Initialization failed");
    if (error instanceof Error) {
      console.error(chalk.red("Error:"), error.message);
    } else {
      console.error(chalk.red("Error:"), error);
    }
    process.exit(1);
  }
}
