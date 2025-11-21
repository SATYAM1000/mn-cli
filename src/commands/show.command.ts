import path from "path";
import os from "os";
import chalk from "chalk";
import { select } from "@inquirer/prompts";
import ora from "ora";
import { highlight } from "cli-highlight";
import boxen from "boxen";
import { formatDistanceToNow } from "date-fns";
import { loadConfig } from "../lib/config.js";
import { listNotes, findNoteByTitle } from "../lib/note.js";

export async function showCommand(title?: string) {
  const spinner = ora();

  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, ".notes");
    const configPath = path.join(notesPath, "config.json");

    // Check if notes is initialized
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

    let noteToShow;

    // If title provided, search for it
    if (title) {
      spinner.start("Searching for note...");
      noteToShow = await findNoteByTitle(notesPath, title);
      spinner.stop();

      if (!noteToShow) {
        console.log(chalk.red(`✖ Note "${title}" not found.`));
        console.log(
          chalk.yellow("Use"),
          chalk.cyan("mn list"),
          chalk.yellow("to see all notes.")
        );
        process.exit(1);
      }
    } else {
      // No title provided, show list to select
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

      // Show selection list
      const choices = notes.map((note) => ({
        name: `${note.frontmatter.title} (${note.frontmatter.folder})`,
        value: note.filePath,
        description: `Created ${new Date(
          note.frontmatter.created
        ).toLocaleDateString()}`,
      }));

      const selectedPath = await select({
        message: "Select a note to view:",
        choices,
        pageSize: 10,
      });

      noteToShow = notes.find((n) => n.filePath === selectedPath);
    }

    if (!noteToShow) {
      console.log(chalk.red("✖ Failed to select note."));
      process.exit(1);
    }

    // Display note metadata in a box
    const metadata = [
      `${chalk.bold("Title:")} ${chalk.cyan(noteToShow.frontmatter.title)}`,
      `${chalk.bold("Folder:")} ${chalk.yellow(noteToShow.frontmatter.folder)}`,
      `${chalk.bold("Created:")} ${chalk.gray(
        formatDistanceToNow(new Date(noteToShow.frontmatter.created), {
          addSuffix: true,
        })
      )}`,
      `${chalk.bold("Updated:")} ${chalk.gray(
        formatDistanceToNow(new Date(noteToShow.frontmatter.updated), {
          addSuffix: true,
        })
      )}`,
    ];

    if (noteToShow.frontmatter.tags && noteToShow.frontmatter.tags.length > 0) {
      metadata.push(
        `${chalk.bold("Tags:")} ${noteToShow.frontmatter.tags
          .map((t) => chalk.magenta(`#${t}`))
          .join(" ")}`
      );
    }

    const metadataBox = boxen(metadata.join("\n"), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "cyan",
      title: "📝 Note Info",
      titleAlignment: "center",
    });

    console.log(metadataBox);

    // Display content
    console.log(chalk.bold.white("Content:\n"));

    if (noteToShow.content.trim()) {
      try {
        // Highlight markdown content
        const highlighted = highlight(noteToShow.content, {
          language: "markdown",
          ignoreIllegals: true,
        });
        console.log(highlighted);
      } catch (error) {
        // If highlighting fails, show plain content
        console.log(noteToShow.content);
      }
    } else {
      console.log(chalk.gray("(empty note)"));
    }

    console.log(); // Empty line

    // Show actions
    console.log(chalk.gray("─".repeat(60)));
    console.log(chalk.white("Actions:"));
    console.log(
      chalk.gray("  • Edit: ") +
        chalk.cyan(`mn edit "${noteToShow.frontmatter.title}"`)
    );
    console.log(
      chalk.gray("  • Delete: ") +
        chalk.cyan(`mn delete "${noteToShow.frontmatter.title}"`)
    );
  } catch (error) {
    spinner.fail("Failed to show note");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
