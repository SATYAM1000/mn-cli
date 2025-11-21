import path from "path";
import os from "os";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { loadConfig } from "../lib/config.js";
import { searchNotes } from "../lib/note.js";

export async function searchCommand(
  query: string,
  options: { folder?: string }
) {
  const spinner = ora();

  try {
    if (!query || query.trim() === "") {
      console.log(chalk.red("✖ Please provide a search query."));
      console.log(chalk.yellow("Usage:"), chalk.cyan('mn search "your query"'));
      process.exit(1);
    }

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

    const searchText = options.folder ? ` in "${options.folder}"` : "";
    spinner.start(`Searching for "${query}"${searchText}...`);

    const results = await searchNotes(notesPath, query, options.folder);

    spinner.stop();

    if (results.length === 0) {
      console.log(chalk.yellow(`\nNo results found for "${query}".`));
      console.log(
        chalk.gray("Try a different search term or use"),
        chalk.cyan("mn list"),
        chalk.gray("to see all notes.")
      );
      return;
    }

    console.log(
      chalk.blue(`\nFound ${results.length} result(s) for "${query}":\n`)
    );

    const table = new Table({
      head: [
        chalk.cyan("Title"),
        chalk.cyan("Folder"),
        chalk.cyan("Match"),
        chalk.cyan("Preview"),
      ],
      colWidths: [25, 12, 15, 40],
      wordWrap: true,
      style: {
        head: [],
        border: ["gray"],
      },
    });

    for (const result of results) {
      const { note, matches } = result;

      const title =
        note.frontmatter.title || path.basename(note.filePath, ".md");
      const folder = note.frontmatter.folder || "-";

      const matchLocations: string[] = [];
      if (matches.inTitle) matchLocations.push("Title");
      if (matches.inTags) matchLocations.push("Tags");
      if (matches.inContent) matchLocations.push("Content");
      const matchText = matchLocations.join(", ");

      let preview = "-";
      if (matches.inTitle) {
        preview = chalk.white(title);
      } else if (matches.contentSnippet) {
        const regex = new RegExp(`(${query})`, "gi");
        preview = matches.contentSnippet.replace(regex, chalk.yellow("$1"));
      } else if (matches.inTags) {
        preview =
          note.frontmatter.tags?.map((t) => chalk.yellow(`#${t}`)).join(", ") ||
          "-";
      }

      table.push([
        chalk.white(title),
        chalk.gray(folder),
        chalk.cyan(matchText),
        preview,
      ]);
    }

    console.log(table.toString());

    console.log(
      chalk.gray("\nTotal: ") +
        chalk.white(results.length) +
        chalk.gray(" result(s)")
    );
    console.log(
      chalk.gray("\nTip: Use ") +
        chalk.cyan('mn edit "title"') +
        chalk.gray(" to open a note")
    );
  } catch (error) {
    spinner.fail("Search failed");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
