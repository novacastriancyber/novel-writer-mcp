export type ContentRating = "G" | "PG" | "PG-13" | "R" | "UNRATED";
export type Tense = "past" | "present";
export type PointOfView = "first" | "second" | "third-limited" | "third-omniscient" | "multiple";
export type ProjectStatus = "planning" | "drafting" | "revision" | "complete" | "archived";

export interface GenreWeight {
  genre: string;
  weight: number;
}

export interface StyleProfile {
  id: string;
  name: string;
  traits: string[];
  doNotUseList: string[];
}

export interface ProjectSettings {
  workingTitle: string;
  genres: GenreWeight[];
  targetWordCount: number;
  contentRating: ContentRating;
  structureModel: string;
  styleProfiles: StyleProfile[];
  pointOfView: PointOfView;
  tense: Tense;
  setting: string;
  exportTargets: string[];
  doNotUseList: string[];
}

export interface ProjectMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  settings: ProjectSettings;
  projectRoot: string;
  currentDraftVersion: number;
  currentOutlineVersion: number;
  wordCountActual: number;
}
