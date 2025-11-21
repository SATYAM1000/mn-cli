#!/usr/bin/env node

import { Command } from "commander";
import {
  createCommand,
  deleteCommand,
  editCommand,
  initCommand,
  listCommand,
  searchCommand,
  folderConfigCommand,
  folderCreateCommand,
  folderDeleteCommand,
  folderListCommand,
  showCommand,
} from "../commands";
import {
  syncCommand,
  syncSetupCommand,
  syncStatusCommand,
  syncDisableCommand,
} from "../commands/sync.command.js";
import { addCommand } from "../commands/add.command.js";
import { browseCommand } from "../commands/browse.command.js";

const program = new Command();

program
  .name("mn")
  .description("A quick way to takes notes through command line.")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize notes directory")
  .action(initCommand);

program
  .command("create")
  .description("Create a new note")
  .action(createCommand);

program
  .command("list")
  .description("List all notes")
  .option("-f, --folder <folder>", "Filter by folder")
  .action(listCommand);

program
  .command("show [title]")
  .description("Show/preview a note")
  .alias("view")
  .action(showCommand);

program
  .command("edit [title]")
  .description("Edit an existing note")
  .action(editCommand);

program
  .command("search <query>")
  .description("Search notes by title, content, or tags")
  .option("-f, --folder <folder>", "Search only in specific folder")
  .option("-i, --interactive", "Interactive mode - select from results")
  .action(searchCommand);

program
  .command("add <content>")
  .description("Quick add a note")
  .option("-f, --folder <folder>", "Folder to add note to (default: general)")
  .action(addCommand);

program
  .command("browse")
  .description("Browse notes interactively")
  .action(browseCommand);

program
  .command("delete [title]")
  .description("Delete a note")
  .alias("rm")
  .action(deleteCommand);

const folder = program.command("folder").description("Manage folders");

folder
  .command("create [name]")
  .description("Create a new folder")
  .action(folderCreateCommand);

folder
  .command("list")
  .description("List all folders")
  .alias("ls")
  .action(folderListCommand);

folder
  .command("delete [name]")
  .description("Delete a folder")
  .alias("rm")
  .action(folderDeleteCommand);

folder
  .command("config [name]")
  .description("Configure folder settings")
  .action(folderConfigCommand);

// Sync commands
const sync = program.command("sync").description("Sync notes with remote").action(syncCommand);

sync
  .command("setup")
  .description("Setup Git sync with GitHub")
  .action(syncSetupCommand);

sync
  .command("status")
  .description("Show Git sync status")
  .action(syncStatusCommand);

sync
  .command("disable")
  .description("Disable Git sync")
  .action(syncDisableCommand);

program.parse();
