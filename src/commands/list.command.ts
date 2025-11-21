import path from "path";
import os from "os";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { formatDistanceToNow } from "date-fns";
import { loadConfig } from "../lib/config.js";
import { listNotes, getRelativePath } from "../lib/note.js";

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

    const filterText = options.folder ? ` in "${options.folder}"` : "";
    console.log(chalk.blue(`\nFound ${notes.length} note(s)${filterText}:\n`));

    const table = new Table({
      head: [
        chalk.cyan("Title"),
        chalk.cyan("Folder"),
        chalk.cyan("Created"),
        chalk.cyan("Tags"),
      ],
      colWidths: [30, 15, 20, 25],
      wordWrap: true,
      style: {
        head: [],
        border: ["gray"],
      },
    });

    // Add rows
    for (const note of notes) {
      const title =
        note.frontmatter.title || path.basename(note.filePath, ".md");
      const folder = note.frontmatter.folder || "-";
      const created = formatDistanceToNow(new Date(note.frontmatter.created), {
        addSuffix: true,
      });
      const tags = note.frontmatter.tags?.length
        ? note.frontmatter.tags.map((t) => `#${t}`).join(", ")
        : "-";

      table.push([
        chalk.white(title),
        chalk.gray(folder),
        chalk.gray(created),
        chalk.yellow(tags),
      ]);
    }

    console.log(table.toString());

    console.log(
      chalk.gray("\nTotal: ") +
        chalk.white(notes.length) +
        chalk.gray(" note(s)")
    );

    const folderCounts = notes.reduce((acc, note) => {
      const folder = note.frontmatter.folder || "unknown";
      acc[folder] = (acc[folder] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(folderCounts).length > 1) {
      console.log(chalk.gray("\nBy folder:"));
      Object.entries(folderCounts).forEach(([folder, count]) => {
        console.log(
          chalk.gray("  • ") + chalk.cyan(folder) + chalk.gray(`: ${count}`)
        );
      });
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
