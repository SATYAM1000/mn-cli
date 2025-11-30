import path from "path";
import os from "os";
import chalk from "chalk";
import ora from "ora";
import { spawn } from "child_process";
import { loadConfig } from "../lib/config.js";
import { listNotes } from "../lib/note.js";

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

    // Parse the ID (1-indexed for user, 0-indexed internally)
    const noteIndex = parseInt(id, 10) - 1;

    if (isNaN(noteIndex) || noteIndex < 0) {
      console.log(chalk.red("✖ Invalid note ID. Please provide a positive number."));
      process.exit(1);
    }

    spinner.start("Loading notes...");
    const notes = await listNotes(notesPath);
    spinner.stop();

    if (notes.length === 0) {
      console.log(chalk.yellow("No notes found."));
      process.exit(1);
    }

    if (noteIndex >= notes.length) {
      console.log(chalk.red(`✖ Note #${id} not found. You have ${notes.length} note(s).`));
      console.log(chalk.gray(`Use ${chalk.cyan("mn list")} to see all notes with their IDs.`));
      process.exit(1);
    }

    const note = notes[noteIndex];
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

    spinner.start("Copying to clipboard...");
    await copyToClipboard(textToCopy);
    spinner.succeed(chalk.green("Copied to clipboard!"));

    console.log();
    console.log(chalk.bold("Note: ") + chalk.cyan(title));
    console.log(chalk.bold("Type: ") + chalk.gray(copyType));
    console.log(chalk.bold("Length: ") + chalk.gray(`${textToCopy.length} characters`));

    // Show preview of what was copied
    const preview = textToCopy.split("\n").slice(0, 3).join("\n");
    if (textToCopy.split("\n").length > 3) {
      console.log(chalk.bold("\nPreview:"));
      console.log(chalk.gray(preview));
      console.log(chalk.gray("..."));
    } else {
      console.log(chalk.bold("\nCopied:"));
      console.log(chalk.gray(preview));
    }

  } catch (error) {
    spinner.fail("Failed to copy note");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
