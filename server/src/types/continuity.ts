export type IssueSeverity = "blocking" | "warning" | "note";

export interface ContinuityIssue {
  severity: IssueSeverity;
  category: string;
  description: string;
  chapterNumber?: number;
  characterName?: string;
  suggestion?: string;
}

export interface ContinuityReport {
  projectRoot: string;
  checkedAt: string;
  chapterScope?: number;
  issues: ContinuityIssue[];
  blockingCount: number;
  warningCount: number;
  noteCount: number;
  passed: boolean;
  overrideApproved?: boolean;
  summary: string;
}

export interface ReadinessReport {
  projectRoot: string;
  targetChapter: number;
  checkedAt: string;
  ready: boolean;
  blockingIssues: ContinuityIssue[];
  warnings: ContinuityIssue[];
  notes: ContinuityIssue[];
  summary: string;
}

export interface StyleIssue {
  severity: IssueSeverity;
  ruleViolated: string;
  excerpt: string;
  suggestion: string;
}

export interface StyleConsistencyReport {
  projectRoot: string;
  chapterNumber: number;
  checkedAt: string;
  issues: StyleIssue[];
  passed: boolean;
  summary: string;
}

export interface GenreContractIssue {
  severity: IssueSeverity;
  expectation: string;
  observation: string;
  suggestion: string;
}

export interface GenreContractReport {
  projectRoot: string;
  checkedAt: string;
  primaryGenre: string;
  issues: GenreContractIssue[];
  passed: boolean;
  summary: string;
}

export interface ChapterPacingInfo {
  chapterNumber: number;
  wordCount: number;
  paragraphCount: number;
  dialogueRatio: number;
  averageParagraphLength: number;
  pacingLabel: "fast" | "moderate" | "slow";
}

export interface PacingReport {
  projectRoot: string;
  checkedAt: string;
  chapters: ChapterPacingInfo[];
  overallNotes: string[];
  summary: string;
}
