import path from "path";
import os from "os";
import chalk from "chalk";
import { select, Separator } from "@inquirer/prompts";
import ora from "ora";
import { highlight } from "cli-highlight";
import { formatDistanceToNow } from "date-fns";
import { loadConfig } from "../lib/config.js";
import { listNotes } from "../lib/note.js";

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

      // Browse notes in the selected folder with side-by-side preview
      while (true) {
        console.clear();
        const folderName = selectedFolder === "__all__" ? "All Folders" : selectedFolder;

        // Get terminal width
        const terminalWidth = process.stdout.columns || 100;
        const leftWidth = Math.floor(terminalWidth * 0.4);
        const rightWidth = terminalWidth - leftWidth - 3; // Account for separator

        // Show header
        console.log(chalk.blue.bold(`\n📝 Notes in ${chalk.cyan(folderName)}`));
        console.log(chalk.gray(`Total: ${notes.length} note(s)\n`));

        // Show side-by-side layout with all notes
        console.log(chalk.gray("─".repeat(terminalWidth)));
        console.log(
          chalk.cyan.bold(` ${"Note List".padEnd(leftWidth - 2)}`) +
          chalk.gray(" │ ") +
          chalk.cyan.bold("Preview")
        );
        console.log(chalk.gray("─".repeat(terminalWidth)));

        // Display notes list with preview side by side
        const maxDisplayNotes = 10;
        const displayNotes = notes.slice(0, maxDisplayNotes);

        for (let i = 0; i < displayNotes.length; i++) {
          const note = displayNotes[i];
          const title = note.frontmatter.title || path.basename(note.filePath, ".md");

          // Truncate title if too long
          const truncatedTitle = title.length > leftWidth - 5
            ? title.substring(0, leftWidth - 8) + "..."
            : title;

          // Get first line of content as preview
          let previewText = note.content.split("\n")[0] || "(empty)";
          if (previewText.length > rightWidth - 5) {
            previewText = previewText.substring(0, rightWidth - 8) + "...";
          }

          // Format the row
          const leftCell = ` ${(i + 1).toString().padStart(2, " ")}. ${truncatedTitle}`.padEnd(leftWidth);
          console.log(
            chalk.white(leftCell) +
            chalk.gray(" │ ") +
            chalk.gray(previewText)
          );
        }

        if (notes.length > maxDisplayNotes) {
          console.log(chalk.gray(`\n... and ${notes.length - maxDisplayNotes} more note(s)`));
        }

        console.log(chalk.gray("─".repeat(terminalWidth)));
        console.log();

        const noteChoices = [
          ...notes.map((note) => {
            const title = note.frontmatter.title || path.basename(note.filePath, ".md");

            // Safely format created date
            let created = "Unknown";
            try {
              const createdDate = new Date(note.frontmatter.created);
              if (!isNaN(createdDate.getTime())) {
                created = formatDistanceToNow(createdDate, { addSuffix: true });
              }
            } catch (e) {
              created = "Unknown date";
            }

            const tags = note.frontmatter.tags?.length
              ? note.frontmatter.tags.map((t) => `#${t}`).join(" ")
              : "";

            return {
              name: title,
              value: note.filePath,
              description: `${chalk.gray(created)} ${tags ? chalk.yellow(tags) : ""}`,
            };
          }),
          {
            name: chalk.gray("← Back to folders"),
            value: "__back__",
            description: "",
          },
        ];

        const selectedNote = await select({
          message: "Select a note to view full preview:",
          choices: noteChoices,
          pageSize: 10,
        });

        if (selectedNote === "__back__") {
          break;
        }

        // Show full note preview
        const note = notes.find((n) => n.filePath === selectedNote);
        if (!note) continue;

        console.clear();
        console.log(chalk.blue.bold("\n📄 Full Note Preview\n"));

        // Note metadata
        console.log(chalk.bold("Title: ") + chalk.cyan(note.frontmatter.title));
        console.log(chalk.bold("Folder: ") + chalk.yellow(note.frontmatter.folder));

        // Safely format dates
        try {
          const createdDate = new Date(note.frontmatter.created);
          if (!isNaN(createdDate.getTime())) {
            console.log(
              chalk.bold("Created: ") +
                chalk.gray(formatDistanceToNow(createdDate, { addSuffix: true }))
            );
          }
        } catch (e) {
          console.log(chalk.bold("Created: ") + chalk.gray("Unknown"));
        }

        try {
          const updatedDate = new Date(note.frontmatter.updated);
          if (!isNaN(updatedDate.getTime())) {
            console.log(
              chalk.bold("Updated: ") +
                chalk.gray(formatDistanceToNow(updatedDate, { addSuffix: true }))
            );
          }
        } catch (e) {
          console.log(chalk.bold("Updated: ") + chalk.gray("Unknown"));
        }

        if (note.frontmatter.tags && note.frontmatter.tags.length > 0) {
          console.log(
            chalk.bold("Tags: ") +
              note.frontmatter.tags.map((t) => chalk.magenta(`#${t}`)).join(" ")
          );
        }

        console.log(chalk.gray("\n" + "─".repeat(60) + "\n"));

        // Content preview
        if (note.content.trim()) {
          try {
            // Show first 20 lines of content
            const lines = note.content.split("\n").slice(0, 20);
            const preview = lines.join("\n");
            const highlighted = highlight(preview, {
              language: "markdown",
              ignoreIllegals: true,
            });
            console.log(highlighted);

            if (note.content.split("\n").length > 20) {
              console.log(chalk.gray("\n... (content truncated)\n"));
            }
          } catch (error) {
            console.log(note.content.split("\n").slice(0, 20).join("\n"));
          }
        } else {
          console.log(chalk.gray("(empty note)"));
        }

        console.log(chalk.gray("\n" + "─".repeat(60) + "\n"));

        // Action menu
        const action = await select({
          message: "What would you like to do?",
          choices: [
            {
              name: "📝 Edit this note",
              value: "edit",
              description: `mn edit "${note.frontmatter.title}"`,
            },
            {
              name: "👁️  View full note",
              value: "view",
              description: `mn show "${note.frontmatter.title}"`,
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
              `mn ${action} "${note.frontmatter.title}"`
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
