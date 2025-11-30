import path from "path";
import os from "os";
import chalk from "chalk";
import ora from "ora";
import { spawn } from "child_process";
import { loadConfig } from "../lib/config.js";
import { findNoteById } from "../lib/note.js";

// Copy text to clipboard based on platform
async function copyToClipboard(text: string): Promise<void> {
  const platform = process.platform;

  return new Promise((resolve, reject) => {
    let proc;

    if (platform === "darwin") {
      // macOS
      proc = spawn("pbcopy");
    } else if (platform === "linux") {
      // Linux - try xclip
      proc = spawn("xclip", ["-selection", "clipboard"]);
    } else if (platform === "win32") {
      // Windows
      proc = spawn("clip");
    } else {
      reject(new Error(`Unsupported platform: ${platform}`));
      return;
    }

    proc.on("error", (err) => {
      reject(new Error(`Failed to copy: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Clipboard command exited with code ${code}`));
      }
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
}

export async function copyCommand(id: string, options: { content?: boolean; title?: boolean }) {
  const spinner = ora();

  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, ".notes");
    const configPath = path.join(notesPath, "config.json");

    const config = await loadConfig(configPath);
    if (!config) {
      console.log(chalk.red("✖ Notes not initialized."));
      console.log(chalk.yellow("Run"), chalk.cyan("mn init"), chalk.yellow("first."));
      process.exit(1);
    }

    // Parse the stable ID
    const noteId = parseInt(id, 10);

    if (isNaN(noteId) || noteId < 1) {
      console.log(chalk.red("✖ Invalid note ID. Please provide a positive number."));
      process.exit(1);
    }

    spinner.start("Finding note...");
    const note = await findNoteById(notesPath, noteId);
    spinner.stop();

    if (!note) {
      console.log(chalk.red(`✖ Note with ID [${id}] not found.`));
      console.log(chalk.gray(`Use ${chalk.cyan("mn list")} to see all notes with their IDs.`));
      process.exit(1);
    }

    const title = note.frontmatter.title || path.basename(note.filePath, ".md");

    // Determine what to copy
    let textToCopy: string;
    let copyType: string;

    if (options.title) {
      // Copy only the title
      textToCopy = title;
      copyType = "title";
    } else if (options.content) {
      // Copy only the content (without frontmatter)
      textToCopy = note.content.trim();
      copyType = "content";
    } else {
      // Default: copy content (most useful)
      textToCopy = note.content.trim();
      copyType = "content";
    }

    if (!textToCopy) {
      console.log(chalk.yellow(`✖ Note "${title}" has no ${copyType} to copy.`));
      process.exit(1);
    }

    await copyToClipboard(textToCopy);
    spinner.stop();

    // Simple output
    console.log(chalk.green("✓") + ` Copied [${noteId}] to clipboard`);

  } catch (error) {
    spinner.fail("Failed to copy note");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
