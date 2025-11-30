import path from "path";
import os from "os";
import chalk from "chalk";
import { spawn } from "child_process";
import { confirm } from "@inquirer/prompts";
import { loadConfig } from "../lib/config.js";
import { findNoteById } from "../lib/note.js";

export async function useCommand(id: string) {
  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, ".notes");
    const configPath = path.join(notesPath, "config.json");

    const config = await loadConfig(configPath);
    if (!config) {
      console.log(chalk.red("✖ Notes not initialized."));
      process.exit(1);
    }

    const noteId = parseInt(id, 10);
    if (isNaN(noteId) || noteId < 1) {
      console.log(chalk.red("✖ Invalid note ID."));
      process.exit(1);
    }

    const note = await findNoteById(notesPath, noteId);
    if (!note) {
      console.log(chalk.red(`✖ Note [${id}] not found.`));
      process.exit(1);
    }

    // Get the command from note content (first line or full content if single line)
    const content = note.content.trim();
    if (!content) {
      console.log(chalk.red("✖ Note is empty."));
      process.exit(1);
    }

    // Use first line as command
    const command = content.split("\n")[0].trim();

    // Show the command and ask for confirmation
    console.log(chalk.gray(`[${noteId}]`) + ` ${chalk.cyan(command)}`);

    const shouldExecute = await confirm({
      message: "Execute this command?",
      default: true,
    });

    if (!shouldExecute) {
      console.log(chalk.gray("Cancelled."));
      process.exit(0);
    }

    // Execute the command
    console.log();
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
      cwd: process.cwd(),
    });

    child.on("close", (code) => {
      process.exit(code || 0);
    });

    child.on("error", (err) => {
      console.error(chalk.red("✖ Failed to execute:"), err.message);
      process.exit(1);
    });

  } catch (error) {
    console.error(
      chalk.red("✖"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
