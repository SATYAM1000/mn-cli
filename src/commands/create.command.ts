import path from "path";
import os from "os";
import chalk from "chalk";
import { input, select } from "@inquirer/prompts";
import ora from "ora";
import { loadConfig, createNote } from "../lib";
import { autoSync } from "../lib/sync.js";

export async function createCommand() {
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

    const folders = Object.keys(config.folderSettings);

    // ASK FOR FOLDER

    const folder = await select({
      message: "Select a folder:",
      choices: folders.map((f) => ({
        name: f,
        value: f,
        description: config.folderSettings[f].encrypted ? "🔒 Encrypted" : "",
      })),
    });

    const title = await input({
      message: "Enter note title:",
      validate: (value) => {
        if (!value.trim()) {
          return "Title cannot be empty";
        }
        return true;
      },
    });

    spinner.start("Creating note...");
    const filePath = await createNote(notesPath, folder, title);
    spinner.succeed("Note created successfully!");

    console.log(chalk.green("\n✓ Note created!\n"));
    console.log(chalk.gray("Location: ") + chalk.cyan(filePath));
    console.log(chalk.gray("Folder: ") + chalk.cyan(folder));
    console.log(chalk.gray("Title: ") + chalk.cyan(title));

    if (config.folderSettings[folder].encrypted) {
      console.log(
        chalk.yellow("\n⚠ Note: This folder is marked as encrypted.")
      );
      console.log(
        chalk.yellow("Encryption will be implemented in future updates.")
      );
    }

    // SUGGEST NEXT ACTIONS

    console.log(chalk.white("\nNext steps:"));
    console.log(
      chalk.gray("  • Edit the note: ") + chalk.yellow(`mn edit "${title}"`)
    );
    console.log(chalk.gray("  • List all notes: ") + chalk.yellow("mn list"));

    // Auto-sync with remote
    await autoSync(`Create note: ${title}`);
  } catch (error) {
    spinner.fail("Failed to create note");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
