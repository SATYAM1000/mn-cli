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
    const { filePath, id } = await createNote(notesPath, folder, title);
    spinner.succeed("Note created!");

    // Compact output like nb
    const filename = path.basename(filePath);
    console.log(chalk.gray(`[${id}]`) + ` ${chalk.green(filename)} · "${title}"`);

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
