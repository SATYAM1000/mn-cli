import path from "path";
import os from "os";
import chalk from "chalk";
import { select } from "@inquirer/prompts";
import ora from "ora";
import { formatDistanceToNow } from "date-fns";
import readline from "readline";
import { loadConfig } from "../lib/config.js";
import { listNotes } from "../lib/note.js";
import { Note } from "../types/note.js";

// Helper to wrap text to width
function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  const words = text.split(' ');
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length > width) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  return lines;
}

// Helper to render side-by-side layout with real-time preview
async function browseSideBySide(notes: Note[], folderName: string): Promise<Note | null> {
  return new Promise((resolve) => {
    let selectedIndex = 0;
    const terminalWidth = process.stdout.columns || 100;
    const terminalHeight = process.stdout.rows || 30;
    const leftWidth = Math.floor(terminalWidth * 0.4);
    const rightWidth = terminalWidth - leftWidth - 3;

    // Set up readline for key handling
    // Resume stdin if paused
    if (process.stdin.isPaused()) {
      process.stdin.resume();
    }

    // Enable keypress events (safe to call multiple times)
    try {
      readline.emitKeypressEvents(process.stdin);
    } catch (e) {
      // Already enabled, ignore
    }

    // Set raw mode AFTER emitKeypressEvents
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    function render() {
      console.clear();

      // Header
      console.log(chalk.blue.bold(`\n📝 Notes in ${chalk.cyan(folderName)}`));
      console.log(chalk.gray(`Total: ${notes.length} note(s)\n`));
      console.log(chalk.gray("─".repeat(terminalWidth)));

      // Column headers
      const leftHeader = ` ${"Note List".padEnd(leftWidth - 2)}`;
      const rightHeader = "Preview";
      console.log(
        chalk.cyan.bold(leftHeader) +
        chalk.gray(" │ ") +
        chalk.cyan.bold(rightHeader)
      );
      console.log(chalk.gray("─".repeat(terminalWidth)));

      // Calculate how many notes we can show
      const maxListLines = Math.min(terminalHeight - 10, notes.length);
      const startIdx = Math.max(0, Math.min(selectedIndex - Math.floor(maxListLines / 2), notes.length - maxListLines));
      const endIdx = Math.min(notes.length, startIdx + maxListLines);

      // Get selected note for preview
      const selectedNote = notes[selectedIndex];
      let previewLines: string[] = [];

      if (selectedNote) {
        // Format preview content
        previewLines.push(chalk.bold("Title: ") + chalk.cyan(selectedNote.frontmatter.title || "(untitled)"));
        previewLines.push(chalk.bold("Folder: ") + chalk.yellow(selectedNote.frontmatter.folder));

        // Date info
        try {
          const createdDate = new Date(selectedNote.frontmatter.created);
          if (!isNaN(createdDate.getTime())) {
            previewLines.push(chalk.bold("Created: ") + chalk.gray(formatDistanceToNow(createdDate, { addSuffix: true })));
          }
        } catch (e) {}

        // Tags
        if (selectedNote.frontmatter.tags && selectedNote.frontmatter.tags.length > 0) {
          previewLines.push(chalk.bold("Tags: ") + selectedNote.frontmatter.tags.map(t => chalk.magenta(`#${t}`)).join(" "));
        }

        previewLines.push(""); // Empty line

        // Content preview (wrapped)
        const contentLines = selectedNote.content.split("\n").slice(0, 15);
        for (const line of contentLines) {
          const wrapped = wrapText(line || " ", rightWidth - 2);
          previewLines.push(...wrapped);
        }

        if (selectedNote.content.split("\n").length > 15) {
          previewLines.push(chalk.gray("... (truncated)"));
        }
      }

      // Render side by side
      const displayNotes = notes.slice(startIdx, endIdx);
      const maxLines = Math.max(displayNotes.length, previewLines.length);

      for (let i = 0; i < maxLines; i++) {
        let leftCell = "";
        let rightCell = "";

        // Left side - note list
        if (i < displayNotes.length) {
          const noteIdx = startIdx + i;
          const note = displayNotes[i];
          const title = note.frontmatter.title || path.basename(note.filePath, ".md");
          const truncatedTitle = title.length > leftWidth - 7
            ? title.substring(0, leftWidth - 10) + "..."
            : title;

          const isSelected = noteIdx === selectedIndex;
          const prefix = isSelected ? chalk.cyan("❯ ") : "  ";
          const displayTitle = isSelected ? chalk.cyan.bold(truncatedTitle) : truncatedTitle;

          leftCell = `${prefix}${displayTitle}`.padEnd(leftWidth + (isSelected ? 10 : 0)); // Account for ANSI codes
        } else {
          leftCell = " ".repeat(leftWidth);
        }

        // Right side - preview
        if (i < previewLines.length) {
          rightCell = previewLines[i];
        }

        // Print the row
        // Strip ANSI codes to calculate actual length
        const strippedLeftCell = leftCell.replace(/\u001b\[[0-9;]*m/g, '');
        const padding = leftWidth - strippedLeftCell.length;
        console.log(leftCell + " ".repeat(Math.max(0, padding)) + chalk.gray(" │ ") + rightCell);
      }

      console.log(chalk.gray("─".repeat(terminalWidth)));
      console.log(chalk.gray("\n↑↓ navigate • ⏎ select • q quit • b back"));
    }

    function cleanup() {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeAllListeners('keypress');
    }

    function onKeypress(_str: string, key: any) {
      if (!key) return;

      if (key.name === 'up' || key.name === 'k') {
        selectedIndex = Math.max(0, selectedIndex - 1);
        render();
      } else if (key.name === 'down' || key.name === 'j') {
        selectedIndex = Math.min(notes.length - 1, selectedIndex + 1);
        render();
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(notes[selectedIndex]);
      } else if (key.name === 'q' || key.name === 'escape') {
        cleanup();
        resolve(null);
      } else if (key.name === 'b') {
        cleanup();
        resolve(null);
      } else if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(0);
      }
    }

    // Register keypress handler
    process.stdin.on('keypress', onKeypress);

    // Render initial view
    render();
  });
}

export async function browseCommand() {
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

    const folders = Object.keys(config.folderSettings);

    while (true) {
      // Show folder selection
      console.clear();
      console.log(chalk.blue.bold("\n📁 Browse Notes\n"));

      const folderChoices = [
        ...folders.map((f) => {
          const isEncrypted = config.folderSettings[f].encrypted;
          return {
            name: `${isEncrypted ? "🔒 " : "📂 "}${f}`,
            value: f,
            description: isEncrypted ? "Encrypted folder" : "",
          };
        }),
        {
          name: chalk.gray("← Back to all notes"),
          value: "__all__",
          description: "View all notes across folders",
        },
        {
          name: chalk.red("✖ Exit"),
          value: "__exit__",
          description: "Exit browse mode",
        },
      ];

      const selectedFolder = await select({
        message: "Select a folder to browse:",
        choices: folderChoices,
        pageSize: 15,
      });

      if (selectedFolder === "__exit__") {
        console.log(chalk.gray("\nExiting browse mode..."));
        break;
      }

      // Load notes for selected folder
      spinner.start("Loading notes...");
      const notes = await listNotes(
        notesPath,
        selectedFolder === "__all__" ? undefined : selectedFolder
      );
      spinner.stop();

      if (notes.length === 0) {
        console.log(chalk.yellow("\nNo notes found in this folder."));
        console.log(chalk.gray("Press any key to continue..."));
        await new Promise(resolve => {
          process.stdin.once('data', resolve);
        });
        continue;
      }

      // Browse notes with real-time side-by-side preview
      const folderName = selectedFolder === "__all__" ? "All Folders" : selectedFolder;

      // Small delay to let inquirer clean up
      await new Promise(resolve => setTimeout(resolve, 100));

      const selectedNote = await browseSideBySide(notes, folderName);

      if (!selectedNote) {
        // User pressed 'b' or 'q' - go back to folder selection
        continue;
      }

      // Show action menu for selected note
      console.clear();
      console.log(chalk.blue.bold("\n📄 Note Selected\n"));
      console.log(chalk.bold("Title: ") + chalk.cyan(selectedNote.frontmatter.title));
      console.log(chalk.bold("Folder: ") + chalk.yellow(selectedNote.frontmatter.folder));
      console.log();

      const action = await select({
        message: "What would you like to do?",
        choices: [
          {
            name: "📝 Edit this note",
            value: "edit",
            description: `mn edit "${selectedNote.frontmatter.title}"`,
          },
          {
            name: "👁️  View full note",
            value: "view",
            description: `mn show "${selectedNote.frontmatter.title}"`,
          },
          {
            name: "🗑️  Delete this note",
            value: "delete",
            description: "Delete this note",
          },
          {
            name: chalk.gray("← Back to note list"),
            value: "back",
            description: "",
          },
        ],
      });

      if (action === "back") {
        continue;
      }

      // Handle actions
      console.log(
        chalk.yellow(
          `\n💡 To ${action} this note, run: ${chalk.cyan(
            `mn ${action} "${selectedNote.frontmatter.title}"`
          )}\n`
        )
      );
      console.log(chalk.gray("Press any key to continue..."));

      // Wait for keypress
      process.stdin.setRawMode(true);
      await new Promise((resolve) => {
        process.stdin.once("data", () => {
          process.stdin.setRawMode(false);
          resolve(null);
        });
      });
    }
  } catch (error) {
    spinner.fail("Failed to browse notes");
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
