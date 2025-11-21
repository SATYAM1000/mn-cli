import fs from "fs-extra";
import path from "path";

export async function createGitIgnore(
  notesPath: string,
  ignoredFolders: string[]
): Promise<void> {
  const gitignorePath = path.join(notesPath, ".gitignore");
  const gitignoreContent = `# Notes CLI - Auto-generated gitignore

# Folders marked as gitignored
${ignoredFolders.map((folder) => `${folder}/`).join("\n")}

# System files
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.temp
~*

# Editor files
.vscode/
.idea/
*.swp
*.swo
`;

  await fs.writeFile(gitignorePath, gitignoreContent.trim());
}
