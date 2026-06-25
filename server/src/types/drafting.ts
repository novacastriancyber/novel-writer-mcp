export type RevisionPassType =
  | "developmental"
  | "structure"
  | "character-motivation"
  | "dialogue"
  | "pacing"
  | "voice-consistency"
  | "show-vs-tell"
  | "genre-expectation"
  | "continuity-repair"
  | "copy-edit"
  | "proofread"
  | "export-cleanup";

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ModelRoute = "host" | "llamacpp" | "openrouter";

export interface RevisionPass {
  id: string;
  passType: RevisionPassType;
  instructions: string;
  scope: "chapter" | "range" | "full-manuscript";
  chapterNumber?: number;
  chapterRange?: [number, number];
  inputVersion: number;
  outputVersion?: number;
  changeSummary?: string;
  modelRoute: ModelRoute;
  createdAt: string;
  approvalStatus: ApprovalStatus;
}

export interface DraftContext {
  chapterNumber: number;
  chapterBrief?: string;
  previousChapterSummary?: string;
  activeCharacters: string;
  worldNotes: string;
  styleGuideSummary: string;
  continuityObligations: string;
  openThreads: string;
  researchNotes: string;
  assembledAt: string;
}

export interface VersionComparison {
  chapterNumber: number;
  versionA: number;
  versionB: number;
  wordCountA: number;
  wordCountB: number;
  wordCountDelta: number;
  addedParagraphs: number;
  removedParagraphs: number;
  commonParagraphs: number;
  significantChanges: string[];
  summary: string;
}

export interface WordCountProgress {
  targetWordCount: number;
  actualWordCount: number;
  percentComplete: number;
  chapterBreakdown: ChapterWordCount[];
  estimatedChaptersRemaining: number;
  averageWordsPerChapter: number;
}

export interface ChapterWordCount {
  chapterNumber: number;
  wordCount: number;
  approved: boolean;
  hasContent: boolean;
}

export interface DraftSession {
  projectId: string;
  revisionPasses: RevisionPass[];
  updatedAt: string;
}
