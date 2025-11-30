export interface NoteFrontmatter {
  id?: number;
  title: string;
  created: string;
  updated: string;
  tags?: string[];
  folder: string;
}

export interface Note {
  frontmatter: NoteFrontmatter;
  content: string;
  filePath: string;
}
