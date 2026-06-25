export type Provider = "host" | "llamacpp" | "openrouter";

export type TaskType =
  | "outline"
  | "draft"
  | "continuity"
  | "revision"
  | "export"
  | "style-check"
  | "genre-check"
  | "pacing-check"
  | "research"
  | "summary";

export interface RouteDecision {
  task: TaskType;
  provider: Provider;
  modelAlias?: string;
  requiresCloudApproval: boolean;
  approvedByAuthor: boolean;
  resolvedAt: string;
}

export interface RouteAuditRecord {
  id: string;
  task: TaskType;
  provider: Provider;
  modelAlias?: string;
  projectRoot?: string;
  inputTokenEstimate?: number;
  outputFile?: string;
  approvedByAuthor: boolean;
  outcome: "success" | "failure" | "blocked";
  errorMessage?: string;
  durationMs?: number;
  createdAt: string;
}

export interface ProviderHealthResult {
  provider: Provider;
  reachable: boolean;
  modelAlias?: string;
  latencyMs?: number;
  errorMessage?: string;
  checkedAt: string;
}

export interface ModelPolicyUpdate {
  task: TaskType;
  provider: Provider;
}
