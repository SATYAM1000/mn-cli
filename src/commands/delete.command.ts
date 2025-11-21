import path from "path";
import os from "os";
import chalk from "chalk";
import { confirm, select } from "@inquirer/prompts";
import ora from "ora";
import { loadConfig } from "../lib/config.js";
import { listNotes, findNoteByTitle, deleteNote } from "../lib/note.js";

export async function deleteCommand(title?: string) {
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

    let noteToDelete;

    if (title) {
      spinner.start("Searching for note...");
      noteToDelete = await findNoteByTitle(notesPath, title);
      spinner.stop();

      if (!noteToDelete) {
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
        console.log(chalk.gray("Nothing to delete."));
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
        message: "Select a note to delete:",
        choices,
        pageSize: 10,
      });

      noteToDelete = notes.find((n) => n.filePath === selectedPath);
    }

    if (!noteToDelete) {
      console.log(chalk.red("✖ Failed to select note."));
      process.exit(1);
    }

    console.log(chalk.blue("\nNote to delete:"));
    console.log(
      chalk.gray("  Title: ") + chalk.white(noteToDelete.frontmatter.title)
    );
    console.log(
      chalk.gray("  Folder: ") + chalk.cyan(noteToDelete.frontmatter.folder)
    );
    console.log(chalk.gray("  Location: ") + chalk.gray(noteToDelete.filePath));

    const shouldDelete = await confirm({
      message: chalk.red(
        "Are you sure you want to delete this note? This cannot be undone."
      ),
      default: false,
    });

    if (!shouldDelete) {
      console.log(chalk.yellow("\n✖ Deletion cancelled."));
      return;
    }

    spinner.start("Deleting note...");
    await deleteNote(noteToDelete.filePath);
    spinner.succeed("Note deleted!");

    console.log(chalk.green("\n✓ Note deleted successfully!"));
  } catch (error) {
    spinner.fail("Failed to delete note");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
