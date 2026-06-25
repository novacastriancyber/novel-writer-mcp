export type SynopsisLength = "short" | "full";
export type StructureModel =
  | "three-act"
  | "hero-journey"
  | "save-the-cat"
  | "five-act"
  | "fichtean-curve"
  | "story-circle"
  | "custom";

export interface Premise {
  id: string;
  ideaSource: string;
  premise: string;
  logline: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Synopsis {
  id: string;
  length: SynopsisLength;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface GenreContractEntry {
  promise: string;
  mandatory: boolean;
  notes?: string;
}

export interface GenreContract {
  id: string;
  genres: string[];
  promises: GenreContractEntry[];
  readerExpectations: string[];
  tropeGuidance: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StyleGuide {
  id: string;
  profiles: StyleProfileEntry[];
  sentenceRhythm: string;
  paragraphLength: string;
  dialogueStyle: string;
  descriptionDensity: string;
  povNotes: string;
  tenseNotes: string;
  vocabularyLevel: string;
  doNotUseList: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StyleProfileEntry {
  name: string;
  traits: string[];
  sourceNotes: string;
}

export interface StructurePlan {
  id: string;
  model: StructureModel;
  customName?: string;
  acts: Act[];
  totalChapters: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Act {
  number: number;
  name: string;
  purpose: string;
  chapterRange: [number, number];
  keyTurningPoint: string;
}

export interface ChapterBrief {
  chapterNumber: number;
  title: string;
  povCharacter: string;
  location: string;
  dramaticQuestion: string;
  goal: string;
  outcome: string;
  continuityItems: string[];
  sceneCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SceneBrief {
  chapterNumber: number;
  sceneNumber: number;
  title: string;
  povCharacter: string;
  location: string;
  goal: string;
  conflict: string;
  outcome: string;
  hook: string;
  endHook: string;
  wordCountTarget: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPlan {
  projectId: string;
  premise?: Premise;
  synopses: Synopsis[];
  genreContract?: GenreContract;
  styleGuide?: StyleGuide;
  structurePlan?: StructurePlan;
  chapterBriefs: ChapterBrief[];
  sceneBriefs: SceneBrief[];
  updatedAt: string;
}
