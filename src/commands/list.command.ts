import path from "path";
import os from "os";
import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../lib/config.js";
import { listNotes } from "../lib/note.js";

export async function listCommand(options: { folder?: string }) {
  const spinner = ora();
  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, ".notes");
    const configPath = path.join(notesPath, "config.json");

    // check if notes is initialized
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

    spinner.start("Loading notes...");

    const notes = await listNotes(notesPath, options.folder);

    spinner.stop();

    if (notes.length === 0) {
      console.log(chalk.yellow("No notes found."));
      console.log(
        chalk.gray("Create your first note with:"),
        chalk.cyan("mn create")
      );
      return;
    }

    // Compact format like nb
    for (const note of notes) {
      const id = note.frontmatter.id;
      const title = note.frontmatter.title || path.basename(note.filePath, ".md");
      const filename = path.basename(note.filePath);

      // Format: [id] filename · "title"
      const idStr = id !== undefined ? chalk.gray(`[${id}]`) : chalk.gray("[?]");
      const filenameStr = chalk.green(filename);
      const titleStr = chalk.white(`"${title}"`);

      console.log(`${idStr} ${filenameStr} · ${titleStr}`);
    }
  } catch (error) {
    spinner.fail("Failed to list notes");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
