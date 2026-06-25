import { describe, it, expect, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathService } from "../src/services/path.service.js";
import { AuditService } from "../src/services/audit.service.js";
import { ConfigService } from "../src/services/config.service.js";
import { RoutingService } from "../src/services/routing.service.js";
import { ProjectService } from "../src/services/project.service.js";
import { MemoryService } from "../src/services/memory.service.js";
import { PlanningService } from "../src/services/planning.service.js";
import { ExportService } from "../src/services/export.service.js";
import { ProjectSettings } from "../src/types/project.js";
import { ServerConfig } from "../src/types/config.js";

const FAKE_API_KEY = "sk-or-v1-FAKE-SECRET-KEY-DO-NOT-LEAK";

const baseSettings: ProjectSettings = {
  workingTitle: "Secret Novel",
  genres: [{ genre: "thriller", weight: 1.0 }],
  targetWordCount: 20000,
  contentRating: "PG-13",
  structureModel: "three-act",
  styleProfiles: [],
  pointOfView: "third-limited",
  tense: "past",
  setting: "London",
  exportTargets: ["markdown"],
  doNotUseList: [],
};

function makeConfig(tmpDir: string): ServerConfig {
  return {
    approvedRoots: [tmpDir],
    logRetentionDays: 1,
    defaultModelRoutes: [{ task: "draft", provider: "host" }],
    openrouterApiKeyEnv: "OPENROUTER_API_KEY",
    llamacpp: undefined,
  };
}

describe("Secret redaction", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env["OPENROUTER_API_KEY"];
    delete process.env["NOVEL_CONFIG_PATH"];
  });

  function setup() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-secrets-"));
    const config = makeConfig(tmpDir);
    const configPath = path.join(tmpDir, "novel-writer.config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    process.env["NOVEL_CONFIG_PATH"] = configPath;
    process.env["OPENROUTER_API_KEY"] = FAKE_API_KEY;

    const pathSvc = new PathService([tmpDir]);
    const auditSvc = new AuditService(path.join(tmpDir, "logs"), 1);
    const configSvc = new ConfigService();
    const projectSvc = new ProjectService(pathSvc, auditSvc);
    const memorySvc = new MemoryService(pathSvc, auditSvc);
    const planningSvc = new PlanningService(pathSvc, auditSvc);
    const routingSvc = new RoutingService(pathSvc, auditSvc, configSvc);
    const exportSvc = new ExportService(pathSvc, auditSvc, memorySvc, planningSvc, projectSvc);

    const meta = projectSvc.create(baseSettings, tmpDir);
    return { pathSvc, auditSvc, configSvc, projectSvc, memorySvc, planningSvc, routingSvc, exportSvc, meta };
  }

  // ── getSafeConfig never leaks the API key ──────────────────────────────────

  it("getSafeConfig returns openrouterConfigured boolean, not the key", () => {
    const { routingSvc } = setup();
    const safe = routingSvc.getSafeConfig();
    const json = JSON.stringify(safe);
    expect(json).not.toContain(FAKE_API_KEY);
    expect(typeof (safe as { openrouterConfigured?: boolean }).openrouterConfigured).toBe("boolean");
  });

  it("getSafeConfig does not contain any env var name holding a secret", () => {
    const { routingSvc } = setup();
    const safe = routingSvc.getSafeConfig();
    const json = JSON.stringify(safe);
    // The env var name itself is fine; the value must not appear
    expect(json).not.toContain(FAKE_API_KEY);
  });

  // ── Export manifests must not contain secrets ──────────────────────────────

  it("markdown export manifest contains no API key", async () => {
    const { exportSvc, memorySvc, meta } = setup();
    memorySvc.saveChapterVersion(meta.projectRoot, 1, "She walked into the rain.", "draft");
    const manifest = await exportSvc.exportManuscript(meta.projectRoot, "markdown");
    const manifestJson = JSON.stringify(manifest);
    expect(manifestJson).not.toContain(FAKE_API_KEY);
  });

  it("export manifest file on disk contains no API key", async () => {
    const { exportSvc, memorySvc, meta } = setup();
    memorySvc.saveChapterVersion(meta.projectRoot, 1, "She walked into the rain.", "draft");
    await exportSvc.exportManuscript(meta.projectRoot, "markdown");
    const exportsDir = path.join(meta.projectRoot, "exports");
    const manifestFiles = fs.readdirSync(exportsDir).filter((f) => f.endsWith("-manifest.json"));
    expect(manifestFiles.length).toBe(1);
    const content = fs.readFileSync(path.join(exportsDir, manifestFiles[0]!), "utf-8");
    expect(content).not.toContain(FAKE_API_KEY);
  });

  it("exported markdown file contains no API key", async () => {
    const { exportSvc, memorySvc, meta } = setup();
    memorySvc.saveChapterVersion(meta.projectRoot, 1, "She walked into the rain.", "draft");
    const manifest = await exportSvc.exportManuscript(meta.projectRoot, "markdown");
    const content = fs.readFileSync(manifest.outputPath, "utf-8");
    expect(content).not.toContain(FAKE_API_KEY);
  });

  it("exported html file contains no API key", async () => {
    const { exportSvc, memorySvc, meta } = setup();
    memorySvc.saveChapterVersion(meta.projectRoot, 1, "She walked into the rain.", "draft");
    const manifest = await exportSvc.exportManuscript(meta.projectRoot, "html");
    const content = fs.readFileSync(manifest.outputPath, "utf-8");
    expect(content).not.toContain(FAKE_API_KEY);
  });

  // ── Audit logs must not record secrets ─────────────────────────────────────

  it("audit log does not contain API key after route resolution", () => {
    const { routingSvc, auditSvc } = setup();
    routingSvc.resolveRoute("draft", false);
    // Flush any pending audit writes
    const logDir = path.join(tmpDir, "logs");
    if (!fs.existsSync(logDir)) return;
    const logs = fs.readdirSync(logDir).filter((f) => f.endsWith(".jsonl"));
    for (const log of logs) {
      const content = fs.readFileSync(path.join(logDir, log), "utf-8");
      expect(content).not.toContain(FAKE_API_KEY);
    }
  });

  // ── Config file written by updatePolicy must not contain plaintext key ─────

  it("config file written by updatePolicy contains no API key", () => {
    const { routingSvc } = setup();
    routingSvc.updatePolicy([{ task: "draft", provider: "host" }]);
    const configPath = process.env["NOVEL_CONFIG_PATH"]!;
    const content = fs.readFileSync(configPath, "utf-8");
    // The env var name may appear (it's a reference, not the value)
    expect(content).not.toContain(FAKE_API_KEY);
  });
});
