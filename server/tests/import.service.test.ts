import { describe, it, expect, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathService } from "../src/services/path.service.js";
import { AuditService } from "../src/services/audit.service.js";
import { MemoryService } from "../src/services/memory.service.js";
import { ImportService } from "../src/services/import.service.js";
import { ProjectService } from "../src/services/project.service.js";
import { ProjectSettings } from "../src/types/project.js";

function makeServices(tmpDir: string) {
  const pathSvc = new PathService([tmpDir]);
  const auditSvc = new AuditService(path.join(tmpDir, "logs"), 1);
  const memorySvc = new MemoryService(pathSvc, auditSvc);
  const projectSvc = new ProjectService(pathSvc, auditSvc);
  const importSvc = new ImportService(pathSvc, auditSvc, memorySvc);
  return { pathSvc, auditSvc, memorySvc, projectSvc, importSvc };
}

const baseSettings: ProjectSettings = {
  workingTitle: "Planet",
  genres: [{ genre: "sci-fi", weight: 1.0 }],
  targetWordCount: 40000,
  contentRating: "PG-13",
  structureModel: "three-act",
  styleProfiles: [],
  pointOfView: "third-limited",
  tense: "present",
  setting: "Space",
  exportTargets: ["markdown"],
  doNotUseList: [],
};

describe("ImportService", () => {
  let tmpDir: string;
  let projectRoot: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function setup() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-import-"));
    const services = makeServices(tmpDir);
    const meta = services.projectSvc.create(baseSettings, tmpDir);
    projectRoot = meta.projectRoot;
    return services;
  }

  // ── Format detection ────────────────────────────────────────────────────

  it("detects format from file extension", () => {
    const { importSvc } = setup();
    expect(importSvc.detectFormat("file.txt")).toBe("txt");
    expect(importSvc.detectFormat("file.md")).toBe("markdown");
    expect(importSvc.detectFormat("file.markdown")).toBe("markdown");
    expect(importSvc.detectFormat("file.docx")).toBe("docx");
    expect(importSvc.detectFormat("file.pdf")).toBe("pdf");
    expect(importSvc.detectFormat("file.epub")).toBe("epub");
    expect(importSvc.detectFormat("file.csv")).toBe("csv");
  });

  it("throws on unsupported extension", () => {
    const { importSvc } = setup();
    expect(() => importSvc.detectFormat("file.xyz")).toThrow("Unsupported file extension");
  });

  // ── TXT extraction ──────────────────────────────────────────────────────

  it("extracts plain text content", async () => {
    const { importSvc } = setup();
    const txtFile = path.join(tmpDir, "notes.txt");
    fs.writeFileSync(txtFile, "This is a research note about L4 Lagrange points.");
    const text = await importSvc.extract(txtFile, "txt");
    expect(text).toContain("L4 Lagrange");
  });

  // ── Markdown extraction ─────────────────────────────────────────────────

  it("extracts markdown content", async () => {
    const { importSvc } = setup();
    const mdFile = path.join(tmpDir, "outline.md");
    fs.writeFileSync(mdFile, "# Chapter One\n\nYael walks the plain.\n\n## Scene One\n\nThe air smells wrong.");
    const text = await importSvc.extract(mdFile, "markdown");
    expect(text).toContain("Chapter One");
    expect(text).toContain("Yael walks");
  });

  // ── CSV extraction ──────────────────────────────────────────────────────

  it("extracts CSV as key-value rows", async () => {
    const { importSvc } = setup();
    const csvFile = path.join(tmpDir, "timeline.csv");
    fs.writeFileSync(csvFile, "year,event\n2197,Architect core online\n2219,Launch day");
    const text = await importSvc.extract(csvFile, "csv");
    expect(text).toContain("year: 2197");
    expect(text).toContain("event: Architect core online");
  });

  // ── Preview / Confirm / Reject workflow ─────────────────────────────────

  it("preview creates a pending import record", async () => {
    const { importSvc } = setup();
    const txtFile = path.join(tmpDir, "research.txt");
    fs.writeFileSync(txtFile, "Lagrange points are gravitational equilibrium positions.");
    const preview = await importSvc.preview(projectRoot, txtFile, "research", "fact");
    expect(preview.status).toBe("pending");
    expect(preview.format).toBe("txt");
    expect(preview.wordCount).toBeGreaterThan(0);
  });

  it("confirm writes file to research folder and marks preview confirmed", async () => {
    const { importSvc } = setup();
    const txtFile = path.join(tmpDir, "research.txt");
    fs.writeFileSync(txtFile, "The L4 point is gravitationally stable.");
    const preview = await importSvc.preview(projectRoot, txtFile, "research", "fact");
    const record = importSvc.confirm(projectRoot, preview.id, "NASA orbital mechanics reference");
    expect(record.savedTo).toContain("research");
    expect(fs.existsSync(record.savedTo)).toBe(true);
  });

  it("reject marks the preview rejected and writes nothing to project", async () => {
    const { importSvc } = setup();
    const txtFile = path.join(tmpDir, "research.txt");
    fs.writeFileSync(txtFile, "Some content.");
    const preview = await importSvc.preview(projectRoot, txtFile, "research", "fact");
    importSvc.reject(projectRoot, preview.id);
    const researchDir = path.join(projectRoot, "research");
    const files = fs.existsSync(researchDir) ? fs.readdirSync(researchDir).filter((f) => !f.endsWith(".json")) : [];
    expect(files).toHaveLength(0);
  });

  it("cannot confirm an already-rejected import", async () => {
    const { importSvc } = setup();
    const txtFile = path.join(tmpDir, "research.txt");
    fs.writeFileSync(txtFile, "Content.");
    const preview = await importSvc.preview(projectRoot, txtFile, "research", "fact");
    importSvc.reject(projectRoot, preview.id);
    expect(() => importSvc.confirm(projectRoot, preview.id)).toThrow("already rejected");
  });

  it("list_pending returns only unactioned imports", async () => {
    const { importSvc } = setup();
    const f1 = path.join(tmpDir, "r1.txt");
    const f2 = path.join(tmpDir, "r2.txt");
    fs.writeFileSync(f1, "Content one.");
    fs.writeFileSync(f2, "Content two.");
    const p1 = await importSvc.preview(projectRoot, f1, "research", "fact");
    await importSvc.preview(projectRoot, f2, "research", "invention");
    importSvc.confirm(projectRoot, p1.id);
    const pending = importSvc.listPending(projectRoot);
    expect(pending).toHaveLength(1);
    expect(pending[0].sourceType).toBe("invention");
  });

  // ── Section detection ───────────────────────────────────────────────────

  it("detects markdown headings as sections", async () => {
    const { importSvc } = setup();
    const mdFile = path.join(tmpDir, "doc.md");
    fs.writeFileSync(mdFile, "# World History\n\nEarth declined.\n\n## Zone Formation\n\nZones replaced nations.");
    const preview = await importSvc.preview(projectRoot, mdFile, "world-bible", "fact");
    expect(preview.detectedSections.length).toBeGreaterThan(0);
    const headings = preview.detectedSections.map((s) => s.heading);
    expect(headings).toContain("World History");
  });

  // ── Target routing ──────────────────────────────────────────────────────

  it("routes outline import to outline folder", async () => {
    const { importSvc } = setup();
    const mdFile = path.join(tmpDir, "outline.md");
    fs.writeFileSync(mdFile, "# Chapter 1\nYael arrives on Eos.");
    const preview = await importSvc.preview(projectRoot, mdFile, "outline", "invention");
    const record = importSvc.confirm(projectRoot, preview.id);
    expect(record.savedTo).toContain("outline");
  });

  it("routes world-bible import to world folder", async () => {
    const { importSvc } = setup();
    const mdFile = path.join(tmpDir, "world.md");
    fs.writeFileSync(mdFile, "# World Notes\nThe Zones replaced nations.");
    const preview = await importSvc.preview(projectRoot, mdFile, "world-bible", "invention");
    const record = importSvc.confirm(projectRoot, preview.id);
    expect(record.savedTo).toContain("world");
  });
});
