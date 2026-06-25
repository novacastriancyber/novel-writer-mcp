export type CharacterRole = "protagonist" | "antagonist" | "supporting" | "minor";
export type ThreadStatus = "open" | "advanced" | "resolved" | "abandoned";
export type RecordStatus = "active" | "archived";

export interface Character {
  id: string;
  name: string;
  role: CharacterRole;
  aliases: string[];
  age?: number;
  occupation?: string;
  affiliation?: string;
  physicalDescription: string;
  voice: string;
  coreDesire: string;
  coreWound?: string;
  flaw?: string;
  arc?: string;
  relationships: Record<string, string>;
  keyFacts: string[];
  doNotWrite: string[];
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Location {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  atmosphere: string;
  significance: string;
  firstAppearance?: string;
  keyFacts: string[];
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PlotThread {
  id: string;
  title: string;
  description: string;
  threadStatus: ThreadStatus;
  openedInChapter?: number;
  resolvedInChapter?: number;
  obligatedBy: string[];
  relatedCharacters: string[];
  relatedLocations: string[];
  notes: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ResearchNote {
  id: string;
  title: string;
  content: string;
  sourceType: "fact" | "invention";
  citation?: string;
  relatedChapters: number[];
  tags: string[];
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContinuityRecord {
  id: string;
  fact: string;
  establishedInChapter: number;
  category: "character" | "world" | "timeline" | "object" | "clue" | "relationship";
  relatedEntityIds: string[];
  contradictedBy?: string;
  createdAt: string;
}

export interface ChapterVersion {
  chapterNumber: number;
  version: number;
  filePath: string;
  wordCount: number;
  createdAt: string;
  notes?: string;
  approved: boolean;
}

export interface OutlineVersion {
  version: number;
  filePath: string;
  createdAt: string;
  notes?: string;
}

export interface ProjectMemory {
  projectId: string;
  characters: Record<string, Character>;
  locations: Record<string, Location>;
  plotThreads: Record<string, PlotThread>;
  researchNotes: Record<string, ResearchNote>;
  continuityRecords: ContinuityRecord[];
  chapterVersions: ChapterVersion[];
  outlineVersions: OutlineVersion[];
  updatedAt: string;
}
