import { describe, it, expect, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathService } from "../src/services/path.service.js";
import { AuditService } from "../src/services/audit.service.js";
import { ConfigService } from "../src/services/config.service.js";
import { RoutingService } from "../src/services/routing.service.js";

function makeServices(tmpDir: string) {
  const pathSvc = new PathService([tmpDir]);
  const auditSvc = new AuditService(path.join(tmpDir, "logs"), 1);
  const configPath = path.join(tmpDir, "novel-writer.config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    approvedRoots: [tmpDir],
    defaultModelRoutes: [
      { task: "outline", provider: "host" },
      { task: "draft", provider: "host" },
      { task: "continuity", provider: "host" },
      { task: "revision", provider: "host" },
      { task: "export", provider: "host" },
    ],
    exportDefaults: { formats: ["markdown"], outputDir: "exports" },
    contentRating: "PG-13",
    researchCitationMode: "strict",
    logRetentionDays: 7,
    contextBudgetTokens: 100000,
  }, null, 2));
  process.env["NOVEL_CONFIG_PATH"] = configPath;
  const configSvc = new ConfigService();
  const routingSvc = new RoutingService(pathSvc, auditSvc, configSvc);
  return { pathSvc, auditSvc, configSvc, routingSvc, configPath };
}

describe("RoutingService", () => {
  let tmpDir: string;

  afterEach(() => {
    delete process.env["NOVEL_CONFIG_PATH"];
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function setup() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-route-"));
    return makeServices(tmpDir);
  }

  // ── resolveRoute ──────────────────────────────────────────────────────────

  it("resolves 'outline' task to host provider by default", () => {
    const { routingSvc } = setup();
    const decision = routingSvc.resolveRoute("outline");
    expect(decision.provider).toBe("host");
    expect(decision.requiresCloudApproval).toBe(false);
    expect(decision.approvedByAuthor).toBe(true);
  });

  it("does not require cloud approval when provider is host", () => {
    const { routingSvc } = setup();
    const decision = routingSvc.resolveRoute("draft");
    expect(decision.requiresCloudApproval).toBe(false);
  });

  it("requires cloud approval for draft task routed to llamacpp", () => {
    const { routingSvc } = setup();
    // Update policy in-place — no need to re-create services
    routingSvc.updatePolicy([{ task: "draft", provider: "llamacpp" }]);
    const decision = routingSvc.resolveRoute("draft", false);
    expect(decision.requiresCloudApproval).toBe(true);
    expect(decision.approvedByAuthor).toBe(false);
  });

  it("sets approvedByAuthor=true when author explicitly approves cloud route", () => {
    const { routingSvc } = setup();
    routingSvc.updatePolicy([{ task: "draft", provider: "openrouter" }]);
    const decision = routingSvc.resolveRoute("draft", true);
    expect(decision.approvedByAuthor).toBe(true);
  });

  // ── updatePolicy ──────────────────────────────────────────────────────────

  it("updates model policy and persists to config file", () => {
    const { routingSvc, configPath } = setup();
    const updated = routingSvc.updatePolicy([{ task: "continuity", provider: "llamacpp" }]);
    expect(updated.find((p) => p.task === "continuity")?.provider).toBe("llamacpp");
    const written = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(written.defaultModelRoutes.find((p: { task: string }) => p.task === "continuity")?.provider).toBe("llamacpp");
  });

  it("adds a new task policy that does not yet exist", () => {
    const { routingSvc } = setup();
    const updated = routingSvc.updatePolicy([{ task: "summary", provider: "llamacpp" }]);
    expect(updated.find((p) => p.task === "summary")?.provider).toBe("llamacpp");
  });

  // ── testRoute ─────────────────────────────────────────────────────────────

  it("host provider is always reachable", async () => {
    const { routingSvc } = setup();
    const result = await routingSvc.testRoute("host");
    expect(result.reachable).toBe(true);
    expect(result.latencyMs).toBe(0);
  });

  it("llamacpp returns not reachable when url not configured", async () => {
    const { routingSvc } = setup();
    const result = await routingSvc.testRoute("llamacpp");
    expect(result.reachable).toBe(false);
    expect(result.errorMessage).toContain("not configured");
  });

  it("openrouter returns not reachable when api key not set", async () => {
    const { routingSvc } = setup();
    delete process.env["OPENROUTER_API_KEY"];
    const result = await routingSvc.testRoute("openrouter");
    expect(result.reachable).toBe(false);
    expect(result.errorMessage).toContain("API key not found");
  });

  // ── recordRouteAudit / listRouteAudits ────────────────────────────────────

  it("records a route audit and lists it", () => {
    const { routingSvc } = setup();
    routingSvc.recordRouteAudit("draft", "host", "success", { projectRoot: tmpDir });
    const records = routingSvc.listRouteAudits();
    expect(records.length).toBe(1);
    expect(records[0]?.task).toBe("draft");
    expect(records[0]?.provider).toBe("host");
    expect(records[0]?.outcome).toBe("success");
  });

  it("filters route audits by task", () => {
    const { routingSvc } = setup();
    routingSvc.recordRouteAudit("draft", "host", "success");
    routingSvc.recordRouteAudit("continuity", "host", "success");
    const filtered = routingSvc.listRouteAudits({ task: "continuity" });
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.task).toBe("continuity");
  });

  it("filters route audits by provider", () => {
    const { routingSvc } = setup();
    routingSvc.recordRouteAudit("draft", "host", "success");
    routingSvc.recordRouteAudit("draft", "llamacpp", "blocked", { errorMessage: "timed out" });
    const filtered = routingSvc.listRouteAudits({ provider: "llamacpp" });
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.outcome).toBe("blocked");
  });

  it("respects the limit parameter on listRouteAudits", () => {
    const { routingSvc } = setup();
    for (let i = 0; i < 10; i++) {
      routingSvc.recordRouteAudit("draft", "host", "success");
    }
    const limited = routingSvc.listRouteAudits({ limit: 3 });
    expect(limited.length).toBe(3);
  });

  // ── getSafeConfig ─────────────────────────────────────────────────────────

  it("safe config does not expose raw API key", () => {
    const { routingSvc } = setup();
    const safe = routingSvc.getSafeConfig();
    expect(safe).not.toHaveProperty("openrouterApiKeyEnv");
    // It should show whether a key is configured, not the key value itself
    expect(typeof safe["openrouterConfigured"]).toBe("boolean");
  });

  it("safe config includes approved roots and route policies", () => {
    const { routingSvc } = setup();
    const safe = routingSvc.getSafeConfig();
    expect(Array.isArray(safe["approvedRoots"])).toBe(true);
    expect(Array.isArray(safe["defaultModelRoutes"])).toBe(true);
  });

  // ── listAuditEvents ───────────────────────────────────────────────────────

  it("returns empty array when no audit log files exist", () => {
    const { routingSvc } = setup();
    const events = routingSvc.listAuditEvents(path.join(tmpDir, "nonexistent-logs"));
    expect(events).toEqual([]);
  });

  it("reads events from existing audit log files", () => {
    const { routingSvc, auditSvc } = setup();
    auditSvc.log({ type: "tool_call", tool: "test_tool", outcome: "success" });
    const logDir = path.join(tmpDir, "logs");
    const events = routingSvc.listAuditEvents(logDir, 10);
    expect(events.length).toBeGreaterThan(0);
  });
});
