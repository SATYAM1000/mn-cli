import path from "path";
import os from "os";
import chalk from "chalk";
import { select, input } from "@inquirer/prompts";
import ora from "ora";
import { loadConfig } from "../lib/config.js";
import {
  listNotes,
  findNoteByTitle,
  updateNoteTimestamp,
} from "../lib/note.js";
import { openInEditor } from "../utils/editor.js";

export async function editCommand(title?: string) {
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

    let noteToEdit;

    if (title) {
      spinner.start("Searching for note...");
      noteToEdit = await findNoteByTitle(notesPath, title);
      spinner.stop();

      if (!noteToEdit) {
        console.log(chalk.red(`✖ Note "${title}" not found.`));
        console.log(
          chalk.yellow("Use"),
          chalk.cyan("mn list"),
          chalk.yellow("to see all notes.")
        );
        process.exit(1);
      }
    } else {
      spinner.start("Loading notes...");
      const notes = await listNotes(notesPath);
      spinner.stop();

      if (notes.length === 0) {
        console.log(chalk.yellow("No notes found."));
        console.log(
          chalk.gray("Create your first note with:"),
          chalk.cyan("mn create")
        );
        return;
      }

      const choices = notes.map((note) => ({
        name: `${note.frontmatter.title} (${note.frontmatter.folder})`,
        value: note.filePath,
        description: `Created ${new Date(
          note.frontmatter.created
        ).toLocaleDateString()}`,
      }));

      const selectedPath = await select({
        message: "Select a note to edit:",
        choices,
        pageSize: 10,
      });

      noteToEdit = notes.find((n) => n.filePath === selectedPath);
    }

    if (!noteToEdit) {
      console.log(chalk.red("✖ Failed to select note."));
      process.exit(1);
    }

    console.log(
      chalk.blue("\nEditing: ") + chalk.cyan(noteToEdit.frontmatter.title)
    );
    console.log(chalk.gray("Location: ") + chalk.gray(noteToEdit.filePath));

    const folder = noteToEdit.frontmatter.folder;
    if (config.folderSettings[folder]?.encrypted) {
      console.log(
        chalk.yellow("\n⚠ Warning: This note is in an encrypted folder.")
      );
      console.log(chalk.yellow("Encryption is not yet implemented.\n"));
    }

    await openInEditor(noteToEdit.filePath, config.defaultEditor);

    spinner.start("Updating timestamp...");
    await updateNoteTimestamp(noteToEdit.filePath);
    spinner.succeed("Note updated!");

    console.log(chalk.green("\n✓ Note saved successfully!"));
  } catch (error) {
    spinner.fail("Failed to edit note");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
