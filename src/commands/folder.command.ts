import path from "path";
import os from "os";
import chalk from "chalk";
import { input, confirm, select } from "@inquirer/prompts";
import ora from "ora";
import Table from "cli-table3";
import { loadConfig } from "../lib/config.js";
import {
  createFolder,
  listFolders,
  deleteFolder,
  addFolderToConfig,
  removeFolderFromConfig,
  updateFolderSettings,
  sanitizeFolderName,
} from "../lib/folder.js";
import { createGitIgnore } from "../lib/gitignore.js";
import { autoSync } from "../lib/sync.js";

export async function folderCreateCommand(name?: string) {
  const spinner = ora();

  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, ".notes");
    const configPath = path.join(notesPath, "config.json");

    const config = await loadConfig(configPath);

    if (!config) {
      console.log(chalk.red("✖ Notes not initialized."));
      console.log(
        chalk.yellow("Run"),
        chalk.cyan("mn init"),
        chalk.yellow("first.")
      );
      process.exit(1);
    }

    // Get folder name
    let folderName = name;
    if (!folderName) {
      folderName = await input({
        message: "Enter folder name:",
        validate: (value) => {
          if (!value.trim()) return "Folder name cannot be empty";
          const sanitized = sanitizeFolderName(value);
          if (!sanitized) return "Invalid folder name";
          return true;
        },
      });
    }

    const sanitizedName = sanitizeFolderName(folderName);

    // Check if folder already exists in config
    if (config.folderSettings[sanitizedName]) {
      console.log(chalk.red(`✖ Folder "${sanitizedName}" already exists.`));
      process.exit(1);
    }

    // Ask for settings
    const encrypted = await confirm({
      message: "Should this folder be encrypted?",
      default: false,
    });

    const gitIgnored = await confirm({
      message: "Should this folder be excluded from git?",
      default: encrypted, // Default to true if encrypted
    });

    // Create folder
    spinner.start("Creating folder...");

    await createFolder(notesPath, sanitizedName, { encrypted, gitIgnored });
    await addFolderToConfig(configPath, config, sanitizedName, {
      encrypted,
      gitIgnored,
    });

    // Update .gitignore if needed
    if (gitIgnored) {
      const ignoredFolders = Object.entries(config.folderSettings)
        .filter(([_, settings]) => settings.gitIgnored)
        .map(([name, _]) => name);
      ignoredFolders.push(sanitizedName);
      await createGitIgnore(notesPath, ignoredFolders);
    }

    spinner.succeed("Folder created!");

    console.log(chalk.green("\n✓ Folder created successfully!\n"));
    console.log(chalk.gray("Name: ") + chalk.cyan(sanitizedName));
    console.log(
      chalk.gray("Encrypted: ") +
        (encrypted ? chalk.yellow("Yes") : chalk.gray("No"))
    );
    console.log(
      chalk.gray("Git ignored: ") +
        (gitIgnored ? chalk.yellow("Yes") : chalk.gray("No"))
    );

    // Auto-sync with remote
    await autoSync(`Create folder: ${sanitizedName}`);
  } catch (error) {
    spinner.fail("Failed to create folder");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}

// List all folders
export async function folderListCommand() {
  const spinner = ora();

  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, ".notes");
    const configPath = path.join(notesPath, "config.json");

    const config = await loadConfig(configPath);

    if (!config) {
      console.log(chalk.red("✖ Notes not initialized."));
      console.log(
        chalk.yellow("Run"),
        chalk.cyan("mn init"),
        chalk.yellow("first.")
      );
      process.exit(1);
    }

    spinner.start("Loading folders...");
    const folders = await listFolders(notesPath);
    spinner.stop();

    if (folders.length === 0) {
      console.log(chalk.yellow("No folders found."));
      return;
    }

    console.log(chalk.blue(`\nFolders (${folders.length}):\n`));

    // Create table
    const table = new Table({
      head: [
        chalk.cyan("Name"),
        chalk.cyan("Encrypted"),
        chalk.cyan("Git Ignored"),
        chalk.cyan("Status"),
      ],
      colWidths: [20, 15, 15, 20],
      style: {
        head: [],
        border: ["gray"],
      },
    });

    for (const folder of folders) {
      const settings = config.folderSettings[folder];

      if (!settings) {
        // Folder exists but not in config
        table.push([
          chalk.white(folder),
          chalk.gray("-"),
          chalk.gray("-"),
          chalk.yellow("Not configured"),
        ]);
      } else {
        table.push([
          chalk.white(folder),
          settings.encrypted ? chalk.yellow("Yes") : chalk.gray("No"),
          settings.gitIgnored ? chalk.yellow("Yes") : chalk.gray("No"),
          chalk.green("Active"),
        ]);
      }
    }

    console.log(table.toString());
    console.log(
      chalk.gray("\nTotal: ") +
        chalk.white(folders.length) +
        chalk.gray(" folder(s)")
    );
  } catch (error) {
    spinner.fail("Failed to list folders");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}

// Delete a folder
export async function folderDeleteCommand(name?: string) {
  const spinner = ora();

  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, ".notes");
    const configPath = path.join(notesPath, "config.json");

    const config = await loadConfig(configPath);

    if (!config) {
      console.log(chalk.red("✖ Notes not initialized."));
      console.log(
        chalk.yellow("Run"),
        chalk.cyan("mn init"),
        chalk.yellow("first.")
      );
      process.exit(1);
    }

    // Get folder name
    let folderName = name;
    if (!folderName) {
      const folders = await listFolders(notesPath);

      if (folders.length === 0) {
        console.log(chalk.yellow("No folders found."));
        return;
      }

      folderName = await select({
        message: "Select a folder to delete:",
        choices: folders.map((f) => ({ name: f, value: f })),
      });
    }

    // Check if folder exists
    if (!config.folderSettings[folderName]) {
      console.log(chalk.red(`✖ Folder "${folderName}" not found.`));
      process.exit(1);
    }

    // Show warning
    console.log(
      chalk.red(
        "\n⚠ Warning: This will delete the folder and ALL notes inside it!"
      )
    );
    console.log(chalk.gray("Folder: ") + chalk.cyan(folderName));

    const confirmed = await confirm({
      message: chalk.red("Are you absolutely sure? This cannot be undone."),
      default: false,
    });

    if (!confirmed) {
      console.log(chalk.yellow("\n✖ Deletion cancelled."));
      return;
    }

    // Delete folder
    spinner.start("Deleting folder...");

    await deleteFolder(notesPath, folderName);
    await removeFolderFromConfig(configPath, config, folderName);

    // Update .gitignore
    const ignoredFolders = Object.entries(config.folderSettings)
      .filter(([name, settings]) => name !== folderName && settings.gitIgnored)
      .map(([name, _]) => name);
    await createGitIgnore(notesPath, ignoredFolders);

    spinner.succeed("Folder deleted!");

    console.log(chalk.green("\n✓ Folder deleted successfully!"));

    // Auto-sync with remote
    await autoSync(`Delete folder: ${folderName}`);
  } catch (error) {
    spinner.fail("Failed to delete folder");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}

// Configure folder settings
export async function folderConfigCommand(name?: string) {
  const spinner = ora();

  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, ".notes");
    const configPath = path.join(notesPath, "config.json");

    const config = await loadConfig(configPath);

    if (!config) {
      console.log(chalk.red("✖ Notes not initialized."));
      console.log(
        chalk.yellow("Run"),
        chalk.cyan("mn init"),
        chalk.yellow("first.")
      );
      process.exit(1);
    }

    // Get folder name
    let folderName = name;
    if (!folderName) {
      const folders = Object.keys(config.folderSettings);

      if (folders.length === 0) {
        console.log(chalk.yellow("No folders found."));
        return;
      }

      folderName = await select({
        message: "Select a folder to configure:",
        choices: folders.map((f) => ({ name: f, value: f })),
      });
    }

    const currentSettings = config.folderSettings[folderName];

    if (!currentSettings) {
      console.log(chalk.red(`✖ Folder "${folderName}" not found.`));
      process.exit(1);
    }

    console.log(chalk.blue(`\nCurrent settings for "${folderName}":`));
    console.log(
      chalk.gray("Encrypted: ") +
        (currentSettings.encrypted ? chalk.yellow("Yes") : chalk.gray("No"))
    );
    console.log(
      chalk.gray("Git ignored: ") +
        (currentSettings.gitIgnored ? chalk.yellow("Yes") : chalk.gray("No"))
    );
    console.log();

    // Ask for new settings
    const encrypted = await confirm({
      message: "Should this folder be encrypted?",
      default: currentSettings.encrypted,
    });

    const gitIgnored = await confirm({
      message: "Should this folder be excluded from git?",
      default: currentSettings.gitIgnored,
    });

    // Update settings
    spinner.start("Updating settings...");

    await updateFolderSettings(configPath, config, folderName, {
      encrypted,
      gitIgnored,
    });

    // Update .gitignore
    const ignoredFolders = Object.entries(config.folderSettings)
      .filter(([name, settings]) =>
        name === folderName ? gitIgnored : settings.gitIgnored
      )
      .map(([name, _]) => name);
    await createGitIgnore(notesPath, ignoredFolders);

    spinner.succeed("Settings updated!");

    console.log(chalk.green("\n✓ Folder settings updated successfully!"));

    // Auto-sync with remote
    await autoSync(`Configure folder: ${folderName}`);
  } catch (error) {
    spinner.fail("Failed to update folder settings");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
