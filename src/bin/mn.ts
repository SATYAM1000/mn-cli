#!/usr/bin/env node

import { Command } from "commander";
import {
  createCommand,
  editCommand,
  initCommand,
  listCommand,
  searchCommand,
} from "../commands";

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
  .command("edit [title]")
  .description("Edit an existing note")
  .action(editCommand);

program
  .command("search <query>")
  .description("Search notes by title, content, or tags")
  .option("-f, --folder <folder>", "Search only in specific folder")
  .action(searchCommand);

program.parse();
