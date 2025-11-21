import fs from "fs-extra";
import path from "path";
import matter from "gray-matter";
import { NoteFrontmatter, Note } from "../types/note";
import { generateTimestampId } from "@utils/index";

export function generateNoteTemplate(title: string, folder: string): string {
  const now = new Date().toISOString();

  const frontmatter: NoteFrontmatter = {
    title,
    created: now,
    updated: now,
    tags: [],
    folder: [folder],
  };

  const content = matter.stringify("", frontmatter);
  return content;
}

export function sanitizeFilename(filename: string): string {
  // REMOVE SPECIAL CHARACTERS AND REPLACE SPACES WITH HYPHENS
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export async function createContext(
  notesPath: string,
  folder: string,
  title: string
): Promise<string> {
  const filename = `${generateTimestampId()}.md`;
  const folderPath = path.join(notesPath, folder);
  const filePath = path.join(folderPath, filename);

  // check if file already exists
  const exists = await fs.pathExists(filePath);
  if (exists) {
    throw new Error(`Note "${filename}" already exists in ${folder}/`);
  }

  await fs.ensureDir(folderPath);
  const noteContent = generateNoteTemplate(title, folder);
  await fs.writeFile(filePath, noteContent);
  return filePath;
}

export async function readNote(filePath: string): Promise<Note> {
  const fileContent = await fs.readFile(filePath, "utf-8");
  const parsed = matter(fileContent);
  return {
    frontmatter: parsed.data as NoteFrontmatter,
    content: parsed.content,
    filePath,
  };
}
