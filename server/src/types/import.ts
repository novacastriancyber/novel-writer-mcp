export type ImportFormat = "txt" | "markdown" | "docx" | "pdf" | "epub" | "csv";
export type ImportTarget =
  | "research"
  | "outline"
  | "character-bible"
  | "world-bible"
  | "timeline"
  | "chapter-draft";

export type ImportStatus = "pending" | "confirmed" | "rejected";
export type SourceType = "fact" | "invention";

export interface ImportPreview {
  id: string;
  sourceFile: string;
  format: ImportFormat;
  target: ImportTarget;
  extractedText: string;
  wordCount: number;
  detectedSections: ImportSection[];
  sourceType: SourceType;
  status: ImportStatus;
  createdAt: string;
}

export interface ImportSection {
  heading: string;
  content: string;
  wordCount: number;
}

export interface ImportRecord {
  id: string;
  sourceFile: string;
  format: ImportFormat;
  target: ImportTarget;
  wordCount: number;
  sourceType: SourceType;
  confirmedAt: string;
  savedTo: string;
}
