#!/usr/bin/env node

import { Command } from "commander";
import { createCommand, initCommand } from "../commands";

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

program.parse();
