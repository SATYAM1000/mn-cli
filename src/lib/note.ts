import fs from "fs-extra";
import path from "path";
import matter from "gray-matter";
import { NoteFrontmatter, Note } from "../types/note";
import { generateTimestampId } from "../utils";

import { glob } from "glob";

export function generateNoteTemplate(title: string, folder: string): string {
  const now = new Date().toISOString();

  const frontmatter: NoteFrontmatter = {
    title,
    created: now,
    updated: now,
    tags: [],
    folder: folder,
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

export async function createNote(
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

export async function listNotes(
  notesPath: string,
  folder?: string
): Promise<Note[]> {
  const pattern = folder
    ? path.join(notesPath, folder, "*.md")
    : path.join(notesPath, "**", "*.md");

  const files = await glob(pattern, {
    ignore: ["**/node_modules/**", "**/.git/**"],
    absolute: true,
  });

  const notes: Note[] = [];

  for (const file of files) {
    try {
      const note = await readNote(file);
      notes.push(note);
    } catch (error) {
      continue;
    }
  }

  notes.sort((a, b) => {
    const dateA = new Date(a.frontmatter.created).getTime();
    const dateB = new Date(b.frontmatter.created).getTime();
    return dateB - dateA;
  });

  return notes;
}

export function getRelativePath(fullPath: string, notesPath: string): string {
  return path.relative(notesPath, fullPath);
}

export async function findNoteByTitle(
  notesPath: string,
  title: string,
  folder?: string
): Promise<Note | null> {
  const notes = await listNotes(notesPath, folder);

  let found = notes.find(
    (n) => n.frontmatter.title.toLowerCase() === title.toLowerCase()
  );

  if (!found) {
    found = notes.find((n) =>
      n.frontmatter.title.toLowerCase().includes(title.toLowerCase())
    );
  }

  return found || null;
}

export async function updateNoteTimestamp(filePath: string): Promise<void> {
  const note = await readNote(filePath);
  note.frontmatter.updated = new Date().toISOString();

  const updatedContent = matter.stringify(note.content, note.frontmatter);
  await fs.writeFile(filePath, updatedContent);
}

export interface SearchResult {
  note: Note;
  matches: {
    inTitle: boolean;
    inContent: boolean;
    inTags: boolean;
    contentSnippet?: string;
  };
  score: number;
}

export async function searchNotes(
  notesPath: string,
  query: string,
  folder?: string
): Promise<SearchResult[]> {
  const notes = await listNotes(notesPath, folder);
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  for (const note of notes) {
    let score = 0;
    const matches = {
      inTitle: false,
      inContent: false,
      inTags: false,
      contentSnippet: undefined as string | undefined,
    };

    if (note.frontmatter.title.toLowerCase().includes(queryLower)) {
      matches.inTitle = true;
      score += 10;
    }

    if (
      note.frontmatter.tags?.some((tag) =>
        tag.toLowerCase().includes(queryLower)
      )
    ) {
      matches.inTags = true;
      score += 5;
    }

    const contentLower = note.content.toLowerCase();
    if (contentLower.includes(queryLower)) {
      matches.inContent = true;
      score += 3;

      const index = contentLower.indexOf(queryLower);
      const start = Math.max(0, index - 50);
      const end = Math.min(note.content.length, index + query.length + 50);
      let snippet = note.content.substring(start, end).trim();

      if (start > 0) snippet = "..." + snippet;
      if (end < note.content.length) snippet = snippet + "...";

      matches.contentSnippet = snippet;
    }

    if (score > 0) {
      results.push({ note, matches, score });
    }
  }

  results.sort((a, b) => b.score - a.score);

  return results;
}


export async function deleteNote(filePath: string): Promise<void> {
    await fs.remove(filePath);
  }