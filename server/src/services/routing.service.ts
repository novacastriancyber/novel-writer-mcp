import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PathService } from "./path.service.js";
import { AuditService } from "./audit.service.js";
import { ConfigService } from "./config.service.js";
import { ServerConfig, ModelRoutePolicy } from "../types/config.js";
import {
  Provider,
  TaskType,
  RouteDecision,
  RouteAuditRecord,
  ProviderHealthResult,
  ModelPolicyUpdate,
} from "../types/routing.js";

// Tasks that require explicit author approval before routing to a cloud provider
const CLOUD_APPROVAL_REQUIRED_TASKS: TaskType[] = [
  "draft",
  "revision",
  "outline",
  "research",
];

export class RoutingService {
  private routeAudits: RouteAuditRecord[] = [];
  private policyCache: Map<string, Provider>;

  constructor(
    private pathService: PathService,
    private audit: AuditService,
    private configService: ConfigService
  ) {
    const config = this.configService.get();
    this.policyCache = new Map(config.defaultModelRoutes.map((p) => [p.task, p.provider as Provider]));
  }

  // ── Policy resolution ────────────────────────────────────────────────────

  resolveRoute(task: TaskType, authorApproved = false): RouteDecision {
    const provider: Provider = this.policyCache.get(task) ?? "host";

    const requiresCloudApproval =
      provider !== "host" && CLOUD_APPROVAL_REQUIRED_TASKS.includes(task);

    const modelAlias = this.resolveModelAlias(provider);

    const decision: RouteDecision = {
      task,
      provider,
      modelAlias,
      requiresCloudApproval,
      approvedByAuthor: provider === "host" ? true : authorApproved,
      resolvedAt: new Date().toISOString(),
    };

    this.audit.log({
      type: "tool_call",
      outcome: "success",
      details: { action: "resolveRoute", task, provider, requiresCloudApproval },
    });

    return decision;
  }

  private resolveModelAlias(provider: Provider): string | undefined {
    if (provider === "llamacpp") return this.configService.get().llamacpp?.modelAlias;
    return undefined;
  }

  // ── Policy update ────────────────────────────────────────────────────────

  updatePolicy(updates: ModelPolicyUpdate[]): ModelRoutePolicy[] {
    const config = this.configService.get();
    const updated = [...config.defaultModelRoutes];

    for (const { task, provider } of updates) {
      const idx = updated.findIndex((p) => p.task === task);
      if (idx >= 0) {
        updated[idx] = { task, provider };
      } else {
        updated.push({ task, provider });
      }
      this.policyCache.set(task, provider as Provider);
    }

    // Persist to config file
    const configPath = process.env["NOVEL_CONFIG_PATH"] ?? path.join(process.cwd(), "novel-writer.config.json");
    const newConfig: ServerConfig = { ...config, defaultModelRoutes: updated };
    this.pathService.atomicWrite(configPath, JSON.stringify(newConfig, null, 2));

    this.audit.log({
      type: "config_load",
      outcome: "success",
      details: { action: "updatePolicy", tasks: updates.map((u) => u.task) },
    });

    return updated;
  }

  // ── Provider health test ─────────────────────────────────────────────────

  async testRoute(provider: Provider): Promise<ProviderHealthResult> {
    const config = this.configService.get();
    const start = Date.now();

    if (provider === "host") {
      return {
        provider: "host",
        reachable: true,
        latencyMs: 0,
        checkedAt: new Date().toISOString(),
      };
    }

    if (provider === "llamacpp") {
      return this.testLlamacpp(config, start);
    }

    if (provider === "openrouter") {
      return this.testOpenRouter(config, start);
    }

    return {
      provider,
      reachable: false,
      errorMessage: `Unknown provider: ${provider}`,
      checkedAt: new Date().toISOString(),
    };
  }

  private async testLlamacpp(config: ServerConfig, start: number): Promise<ProviderHealthResult> {
    if (!config.llamacpp?.url) {
      return {
        provider: "llamacpp",
        reachable: false,
        errorMessage: "llama.cpp endpoint not configured. Set llamacpp.url in novel-writer.config.json.",
        checkedAt: new Date().toISOString(),
      };
    }

    const healthUrl = config.llamacpp.url.replace(/\/$/, "") + "/health";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(healthUrl, { method: "GET", signal: controller.signal });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        this.audit.log({ type: "tool_call", outcome: "success", details: { action: "testLlamacpp", latencyMs } });
        return {
          provider: "llamacpp",
          reachable: true,
          modelAlias: config.llamacpp.modelAlias,
          latencyMs,
          checkedAt: new Date().toISOString(),
        };
      }

      return {
        provider: "llamacpp",
        reachable: false,
        errorMessage: `Health endpoint returned HTTP ${res.status}`,
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      const msg = err instanceof Error && err.name === "AbortError"
        ? "Connection timed out after 5s"
        : String(err);
      this.audit.log({ type: "tool_call", outcome: "failure", errorMessage: msg, details: { action: "testLlamacpp" } });
      return {
        provider: "llamacpp",
        reachable: false,
        errorMessage: msg,
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  private async testOpenRouter(config: ServerConfig, start: number): Promise<ProviderHealthResult> {
    const keyEnv = config.openrouterApiKeyEnv ?? "OPENROUTER_API_KEY";
    const apiKey = process.env[keyEnv];

    if (!apiKey) {
      return {
        provider: "openrouter",
        reachable: false,
        errorMessage: `API key not found. Set environment variable "${keyEnv}".`,
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        this.audit.log({ type: "tool_call", outcome: "success", details: { action: "testOpenRouter", latencyMs } });
        return {
          provider: "openrouter",
          reachable: true,
          latencyMs,
          checkedAt: new Date().toISOString(),
        };
      }

      return {
        provider: "openrouter",
        reachable: false,
        errorMessage: `OpenRouter API returned HTTP ${res.status}`,
        latencyMs,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      const msg = err instanceof Error && err.name === "AbortError"
        ? "Connection timed out after 8s"
        : String(err);
      this.audit.log({ type: "tool_call", outcome: "failure", errorMessage: msg, details: { action: "testOpenRouter" } });
      return {
        provider: "openrouter",
        reachable: false,
        errorMessage: msg,
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  // ── Route audit records ──────────────────────────────────────────────────

  recordRouteAudit(
    task: TaskType,
    provider: Provider,
    outcome: RouteAuditRecord["outcome"],
    opts: {
      projectRoot?: string;
      modelAlias?: string;
      inputTokenEstimate?: number;
      outputFile?: string;
      approvedByAuthor?: boolean;
      errorMessage?: string;
      durationMs?: number;
    } = {}
  ): RouteAuditRecord {
    const record: RouteAuditRecord = {
      id: `route-${crypto.randomUUID().slice(0, 8)}`,
      task,
      provider,
      modelAlias: opts.modelAlias,
      projectRoot: opts.projectRoot,
      inputTokenEstimate: opts.inputTokenEstimate,
      outputFile: opts.outputFile,
      approvedByAuthor: opts.approvedByAuthor ?? provider === "host",
      outcome,
      errorMessage: opts.errorMessage,
      durationMs: opts.durationMs,
      createdAt: new Date().toISOString(),
    };

    this.routeAudits.push(record);

    // Persist to log directory if we have approved roots
    try {
      const config = this.configService.get();
      if (config.approvedRoots[0]) {
        const logDir = path.join(config.approvedRoots[0], ".novel-writer", "route-audits");
        fs.mkdirSync(logDir, { recursive: true });
        const logFile = path.join(logDir, `route-audits-${new Date().toISOString().slice(0, 10)}.jsonl`);
        fs.appendFileSync(logFile, JSON.stringify(record) + "\n", "utf-8");
      }
    } catch {
      // Non-fatal — audit record still held in memory
    }

    this.audit.log({
      type: "tool_call",
      outcome,
      details: { action: "recordRouteAudit", task, provider, recordId: record.id },
    });

    return record;
  }

  listRouteAudits(opts: { task?: TaskType; provider?: Provider; limit?: number } = {}): RouteAuditRecord[] {
    let results = [...this.routeAudits];
    if (opts.task) results = results.filter((r) => r.task === opts.task);
    if (opts.provider) results = results.filter((r) => r.provider === opts.provider);
    results = results.slice(-(opts.limit ?? 100));
    return results;
  }

  // ── Audit log reader ─────────────────────────────────────────────────────

  listAuditEvents(logDir: string, limit = 50): unknown[] {
    if (!fs.existsSync(logDir)) return [];

    const files = fs.readdirSync(logDir)
      .filter((f) => f.startsWith("audit-") && f.endsWith(".jsonl"))
      .sort()
      .reverse();

    const events: unknown[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(path.join(logDir, file), "utf-8").trim().split("\n").filter(Boolean);
      for (const line of lines.reverse()) {
        try { events.push(JSON.parse(line)); } catch { /* skip malformed */ }
        if (events.length >= limit) break;
      }
      if (events.length >= limit) break;
    }

    return events;
  }

  // ── Safe config view ─────────────────────────────────────────────────────

  getSafeConfig(): Record<string, unknown> {
    const config = this.configService.get();
    return {
      approvedRoots: config.approvedRoots,
      llamacpp: config.llamacpp
        ? { url: config.llamacpp.url, modelAlias: config.llamacpp.modelAlias }
        : null,
      openrouterConfigured: !!config.openrouterApiKeyEnv && !!process.env[config.openrouterApiKeyEnv ?? ""],
      openrouterKeyEnv: config.openrouterApiKeyEnv ?? "(not set)",
      defaultModelRoutes: config.defaultModelRoutes,
      contentRating: config.contentRating,
      researchCitationMode: config.researchCitationMode,
      logRetentionDays: config.logRetentionDays,
      contextBudgetTokens: config.contextBudgetTokens,
      exportDefaults: config.exportDefaults,
    };
  }
}
