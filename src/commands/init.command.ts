import fs from "fs-extra";
import path from "path";
import os from "os";
import chalk from "chalk";
import { input, confirm, select } from "@inquirer/prompts";
import ora from "ora";

import { createDefaultConfig, saveConfig, createGitIgnore } from "../lib";

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
