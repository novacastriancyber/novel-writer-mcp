import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RoutingService } from "../services/routing.service.js";
import { AuditService } from "../services/audit.service.js";
import { Provider, TaskType } from "../types/routing.js";

const TASK_TYPES = [
  "outline", "draft", "continuity", "revision", "export",
  "style-check", "genre-check", "pacing-check", "research", "summary",
] as const;

const PROVIDERS = ["host", "llamacpp", "openrouter"] as const;

export function registerRoutingTools(
  server: McpServer,
  routingService: RoutingService,
  audit: AuditService,
  logDir: string
): void {

  // ── Get safe server config ────────────────────────────────────────────────

  server.tool(
    "get_server_config",
    "Return non-secret server configuration: approved roots, model endpoints (URLs only, no keys), default route policies, and runtime settings.",
    {},
    async () => {
      try {
        const config = routingService.getSafeConfig();
        audit.log({ type: "tool_call", tool: "get_server_config", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(config, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "get_server_config", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Update model policy ───────────────────────────────────────────────────

  server.tool(
    "update_model_policy",
    "Update the model routing policy for one or more task types. Changes are persisted to the config file. Switching a task from 'host' to 'llamacpp' or 'openrouter' will cause the server to call that provider directly for that task type.",
    {
      updates: z.array(z.object({
        task: z.enum(TASK_TYPES).describe("The task type to reroute"),
        provider: z.enum(PROVIDERS).describe("The provider to route this task to"),
      })).min(1),
    },
    async ({ updates }) => {
      try {
        const policies = routingService.updatePolicy(updates as Array<{ task: TaskType; provider: Provider }>);
        audit.log({ type: "tool_call", tool: "update_model_policy", outcome: "success", details: { tasks: updates.map((u) => u.task) } });
        return { content: [{ type: "text" as const, text: JSON.stringify(policies, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "update_model_policy", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Test model route ──────────────────────────────────────────────────────

  server.tool(
    "test_model_route",
    "Test connectivity to a model provider without exposing API keys. For llama.cpp: pings the /health endpoint. For OpenRouter: validates the API key by listing available models. For host: always returns reachable.",
    {
      provider: z.enum(PROVIDERS),
    },
    async ({ provider }) => {
      try {
        const result = await routingService.testRoute(provider as Provider);
        audit.log({ type: "tool_call", tool: "test_model_route", outcome: result.reachable ? "success" : "failure", details: { provider, latencyMs: result.latencyMs } });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "test_model_route", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Resolve route (for use by other tools / claude) ───────────────────────

  server.tool(
    "resolve_model_route",
    "Resolve which provider will handle a given task based on current policy. Returns the decision including whether cloud approval is required.",
    {
      task: z.enum(TASK_TYPES),
      authorApproved: z.boolean().default(false).describe("Set true if the author has explicitly approved sending this task to a cloud provider"),
    },
    async ({ task, authorApproved }) => {
      try {
        const decision = routingService.resolveRoute(task as TaskType, authorApproved);
        audit.log({ type: "tool_call", tool: "resolve_model_route", outcome: "success", details: { task, provider: decision.provider } });
        return { content: [{ type: "text" as const, text: JSON.stringify(decision, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "resolve_model_route", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── List route audits ─────────────────────────────────────────────────────

  server.tool(
    "list_route_audits",
    "List recent model route audit records. Optionally filter by task type or provider.",
    {
      task: z.enum(TASK_TYPES).optional(),
      provider: z.enum(PROVIDERS).optional(),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ task, provider, limit }) => {
      try {
        const records = routingService.listRouteAudits({
          task: task as TaskType | undefined,
          provider: provider as Provider | undefined,
          limit,
        });
        audit.log({ type: "tool_call", tool: "list_route_audits", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: records.length === 0
              ? "No route audit records found."
              : JSON.stringify(records, null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "list_route_audits", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── List audit events ─────────────────────────────────────────────────────

  server.tool(
    "list_audit_events",
    "Return recent audit log events from the server's JSONL audit log files.",
    {
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ limit }) => {
      try {
        const events = routingService.listAuditEvents(logDir, limit);
        audit.log({ type: "tool_call", tool: "list_audit_events", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: events.length === 0
              ? "No audit events found."
              : JSON.stringify(events, null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "list_audit_events", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );
}
