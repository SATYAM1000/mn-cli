#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "../commands/init.command.js";

const program = new Command();

program
  .name("mn")
  .description("A quick way to takes notes through command line.")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize notes directory")
  .action(initCommand);

program.parse();


