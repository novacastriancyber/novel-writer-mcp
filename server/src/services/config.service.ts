import fs from "node:fs";
import path from "node:path";
import { ServerConfig, DEFAULT_CONFIG } from "../types/config.js";

interface ConfigValidationError {
  field: string;
  message: string;
}

export class ConfigService {
  private config: ServerConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath ?? this.resolveDefaultConfigPath();
    this.config = this.loadAndValidate();
  }

  private resolveDefaultConfigPath(): string {
    const envPath = process.env["NOVEL_CONFIG_PATH"];
    if (envPath) return envPath;
    return path.join(process.cwd(), "novel-writer.config.json");
  }

  private loadAndValidate(): ServerConfig {
    let raw: Partial<ServerConfig> = {};

    if (fs.existsSync(this.configPath)) {
      try {
        raw = JSON.parse(fs.readFileSync(this.configPath, "utf-8")) as Partial<ServerConfig>;
      } catch (err) {
        throw new Error(`Config file at ${this.configPath} is not valid JSON: ${String(err)}`);
      }
    }

    const merged: ServerConfig = { ...DEFAULT_CONFIG, ...raw };
    const errors = this.validate(merged);

    if (errors.length > 0) {
      const lines = errors.map((e) => `  [${e.field}] ${e.message}`).join("\n");
      throw new Error(`Configuration validation failed:\n${lines}`);
    }

    return merged;
  }

  private validate(cfg: ServerConfig): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];

    if (!Array.isArray(cfg.approvedRoots)) {
      errors.push({ field: "approvedRoots", message: "must be an array of path strings" });
    } else {
      for (const root of cfg.approvedRoots) {
        if (typeof root !== "string" || root.trim() === "") {
          errors.push({ field: "approvedRoots", message: `entry is not a non-empty string: ${String(root)}` });
        } else if (!path.isAbsolute(root)) {
          errors.push({ field: "approvedRoots", message: `path must be absolute: ${root}` });
        }
      }
    }

    if (cfg.llamacpp) {
      if (!cfg.llamacpp.url || typeof cfg.llamacpp.url !== "string") {
        errors.push({ field: "llamacpp.url", message: "must be a non-empty string" });
      }
      if (!cfg.llamacpp.modelAlias || typeof cfg.llamacpp.modelAlias !== "string") {
        errors.push({ field: "llamacpp.modelAlias", message: "must be a non-empty string" });
      }
    }

    if (cfg.openrouterApiKeyEnv) {
      const val = process.env[cfg.openrouterApiKeyEnv];
      if (!val) {
        errors.push({
          field: "openrouterApiKeyEnv",
          message: `environment variable "${cfg.openrouterApiKeyEnv}" is not set`,
        });
      }
    }

    if (!["G", "PG", "PG-13", "R", "UNRATED"].includes(cfg.contentRating)) {
      errors.push({ field: "contentRating", message: "must be G, PG, PG-13, R, or UNRATED" });
    }

    if (!["strict", "loose"].includes(cfg.researchCitationMode)) {
      errors.push({ field: "researchCitationMode", message: "must be strict or loose" });
    }

    if (typeof cfg.logRetentionDays !== "number" || cfg.logRetentionDays < 1) {
      errors.push({ field: "logRetentionDays", message: "must be a positive integer" });
    }

    if (typeof cfg.contextBudgetTokens !== "number" || cfg.contextBudgetTokens < 1000) {
      errors.push({ field: "contextBudgetTokens", message: "must be at least 1000" });
    }

    return errors;
  }

  get(): ServerConfig {
    return this.config;
  }

  isApprovedRoot(filePath: string): boolean {
    const normalized = path.resolve(filePath);
    return this.config.approvedRoots.some((root) => normalized.startsWith(path.resolve(root)));
  }
}
