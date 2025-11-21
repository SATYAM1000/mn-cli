import path from "path";
import os from "os";
import chalk from "chalk";
import ora from "ora";
import fs from "fs-extra";
import matter from "gray-matter";
import { loadConfig } from "../lib/config.js";
import { generateNoteTemplate } from "../lib/note.js";
import { autoSync } from "../lib/sync.js";

export async function addCommand(content: string, options: { folder?: string }) {
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

    // Validate content
    if (!content || content.trim() === "") {
      console.log(chalk.red("✖ Note content cannot be empty."));
      console.log(chalk.yellow("Usage:"), chalk.cyan('mn add -f folder "Your note content"'));
      process.exit(1);
    }

    // Determine folder
    let folder = options.folder || "general";

    // Check if folder exists
    if (!config.folderSettings[folder]) {
      console.log(chalk.red(`✖ Folder "${folder}" does not exist.`));
      console.log(chalk.yellow("Available folders:"), Object.keys(config.folderSettings).join(", "));
      process.exit(1);
    }

    // Use content as title (truncate if too long)
    const title = content.length > 50 ? content.substring(0, 50) + "..." : content;

    spinner.start("Creating note...");

    // Create note
    const { generateTimestampId } = await import("../utils/index.js");
    const filename = `${generateTimestampId()}.md`;
    const folderPath = path.join(notesPath, folder);
    const filePath = path.join(folderPath, filename);

    await fs.ensureDir(folderPath);

    // Generate note with content as both title and content
    const noteTemplate = generateNoteTemplate(title, folder);
    const parsed = matter(noteTemplate);

    // Set the content and write file
    const noteContent = matter.stringify(content, parsed.data);
    await fs.writeFile(filePath, noteContent);

    spinner.succeed("Note added successfully!");

    console.log(chalk.green("\n✓ Note added!\n"));
    console.log(chalk.gray("Title: ") + chalk.cyan(title));
    console.log(chalk.gray("Folder: ") + chalk.cyan(folder));
    console.log(chalk.gray("Location: ") + chalk.gray(filePath));

    console.log(chalk.white("\nNext steps:"));
    console.log(
      chalk.gray("  • Edit: ") + chalk.yellow(`mn edit "${title}"`)
    );
    console.log(chalk.gray("  • View: ") + chalk.yellow(`mn show "${title}"`));

    await autoSync(`Add note: ${title}`);
  } catch (error) {
    spinner.fail("Failed to add note");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
