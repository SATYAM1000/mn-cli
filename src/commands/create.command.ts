import path from "path";
import os from "os";
import chalk from "chalk";
import { input, select } from "@inquirer/prompts";
import ora from "ora";
import { loadConfig } from "@lib/config";

export async function createCommand() {
  const spinner = ora();

  try {
    const homeDir = os.homedir();
    const notesPath = path.join(homeDir, ".notes");
    const configPath = path.join(notesPath, "config.json");

    const config = await loadConfig(configPath);
  } catch (error) {}
}
