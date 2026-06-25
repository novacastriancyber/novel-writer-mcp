export type AuditEventType =
  | "tool_call"
  | "resource_read"
  | "prompt_get"
  | "file_write"
  | "file_read"
  | "model_route"
  | "project_create"
  | "project_load"
  | "project_archive"
  | "config_load"
  | "config_validation_error"
  | "path_safety_violation";

export interface AuditEvent {
  timestamp: string;
  type: AuditEventType;
  projectId?: string;
  tool?: string;
  resource?: string;
  filePath?: string;
  modelProvider?: string;
  modelName?: string;
  details?: Record<string, unknown>;
  outcome: "success" | "failure" | "blocked";
  errorMessage?: string;
}
