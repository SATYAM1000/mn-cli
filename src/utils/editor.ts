import { spawn } from "child_process";
import chalk from "chalk";

export async function openInEditor(
  filePath: string,
  editorCommand?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const editor =
      editorCommand || process.env.EDITOR || process.env.VISUAL || "vim";

    console.log(chalk.gray(`Opening in ${editor}...`));

    const editorProcess = spawn(editor, [filePath], {
      stdio: "inherit",
      shell: true,
    });

    editorProcess.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Editor exited with code ${code}`));
      }
    });

    editorProcess.on("error", (error) => {
      reject(new Error(`Failed to open editor: ${error.message}`));
    });
  });
}
