export interface ModelEndpoint {
  url: string;
  modelAlias: string;
}

export interface ModelRoutePolicy {
  task: string;
  provider: "llamacpp" | "openrouter" | "host";
}

export interface ServerConfig {
  approvedRoots: string[];
  llamacpp?: ModelEndpoint;
  openrouterApiKeyEnv?: string;
  defaultModelRoutes: ModelRoutePolicy[];
  exportDefaults: {
    formats: string[];
    outputDir: string;
  };
  contentRating: "G" | "PG" | "PG-13" | "R" | "UNRATED";
  researchCitationMode: "strict" | "loose";
  logRetentionDays: number;
  backupDir?: string;
  contextBudgetTokens: number;
}

export const DEFAULT_CONFIG: ServerConfig = {
  approvedRoots: [],
  defaultModelRoutes: [
    { task: "outline", provider: "host" },
    { task: "draft", provider: "host" },
    { task: "continuity", provider: "host" },
    { task: "revision", provider: "host" },
    { task: "export", provider: "host" },
  ],
  exportDefaults: {
    formats: ["markdown"],
    outputDir: "exports",
  },
  contentRating: "PG-13",
  researchCitationMode: "strict",
  logRetentionDays: 90,
  contextBudgetTokens: 100000,
};
