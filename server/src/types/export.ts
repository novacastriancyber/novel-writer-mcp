export type ExportFormat = "markdown" | "html" | "docx" | "epub" | "pdf";

export type ExportStatus = "complete" | "partial" | "failed";

export interface ExportedChapter {
  chapterNumber: number;
  title: string;
  wordCount: number;
  version: number;
  approved: boolean;
}

export interface ExportManifest {
  id: string;
  projectId: string;
  projectTitle: string;
  format: ExportFormat;
  exportedAt: string;
  outputPath: string;
  totalWordCount: number;
  chapterCount: number;
  chapters: ExportedChapter[];
  unresolvedIssues: string[];
  status: ExportStatus;
  notes?: string;
}

export interface ExportReadinessReport {
  projectRoot: string;
  checkedAt: string;
  ready: boolean;
  blockers: string[];
  warnings: string[];
  totalWordCount: number;
  draftedChapters: number;
  approvedChapters: number;
  summary: string;
}

export interface FrontMatter {
  titlePage?: boolean;
  tableOfContents?: boolean;
  dedication?: string;
  acknowledgements?: string;
  authorNote?: string;
}

export interface BackMatter {
  aboutAuthor?: string;
  glossary?: Record<string, string>;
  acknowledgements?: string;
}
