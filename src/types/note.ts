export interface NoteFrontmatter {
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
