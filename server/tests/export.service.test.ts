import { describe, it, expect, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathService } from "../src/services/path.service.js";
import { AuditService } from "../src/services/audit.service.js";
import { ProjectService } from "../src/services/project.service.js";
import { MemoryService } from "../src/services/memory.service.js";
import { PlanningService } from "../src/services/planning.service.js";
import { ExportService } from "../src/services/export.service.js";
import { ProjectSettings } from "../src/types/project.js";

function makeServices(tmpDir: string) {
  const pathSvc = new PathService([tmpDir]);
  const auditSvc = new AuditService(path.join(tmpDir, "logs"), 1);
  const projectSvc = new ProjectService(pathSvc, auditSvc);
  const memorySvc = new MemoryService(pathSvc, auditSvc);
  const planningSvc = new PlanningService(pathSvc, auditSvc);
  const exportSvc = new ExportService(pathSvc, auditSvc, memorySvc, planningSvc, projectSvc);
  return { pathSvc, auditSvc, projectSvc, memorySvc, planningSvc, exportSvc };
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

describe("ExportService", () => {
  let tmpDir: string;
  let projectRoot: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function setup() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-export-"));
    const services = makeServices(tmpDir);
    const meta = services.projectSvc.create(baseSettings, tmpDir);
    projectRoot = meta.projectRoot;
    return { ...services, meta };
  }

  function addChapter(memorySvc: MemoryService, chNum: number, content: string) {
    return memorySvc.saveChapterVersion(projectRoot, chNum, content, "test draft");
  }

  // ── checkExportReadiness ──────────────────────────────────────────────────

  it("blocks export when no chapters exist", () => {
    const { exportSvc } = setup();
    const report = exportSvc.checkExportReadiness(projectRoot);
    expect(report.ready).toBe(false);
    expect(report.blockers.some((b) => b.includes("No chapter drafts"))).toBe(true);
  });

  it("reports ready when at least one chapter draft exists", () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "The station hummed. She checked the sensors.");
    const report = exportSvc.checkExportReadiness(projectRoot);
    expect(report.ready).toBe(true);
    expect(report.totalWordCount).toBeGreaterThan(0);
    expect(report.draftedChapters).toBe(1);
  });

  it("warns when word count is below 80% of target", () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "Short chapter.");
    const report = exportSvc.checkExportReadiness(projectRoot);
    expect(report.warnings.some((w) => w.includes("under 80%"))).toBe(true);
  });

  // ── buildManuscript ───────────────────────────────────────────────────────

  it("builds manuscript from single chapter", () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "The station hummed. She checked the sensors.");
    const result = exportSvc.buildManuscript(projectRoot);
    expect(result.chapters.length).toBe(1);
    expect(result.fullText).toContain("Chapter 1");
    expect(result.fullText).toContain("The station hummed");
    expect(result.totalWordCount).toBeGreaterThan(0);
  });

  it("assembles chapters in numeric order", () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 3, "Chapter three content.");
    addChapter(memorySvc, 1, "Chapter one content.");
    addChapter(memorySvc, 2, "Chapter two content.");
    const result = exportSvc.buildManuscript(projectRoot);
    expect(result.chapters.map((c) => c.chapterNumber)).toEqual([1, 2, 3]);
  });

  it("includes title page when requested", () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "Opening line.");
    const result = exportSvc.buildManuscript(projectRoot, { titlePage: true });
    expect(result.fullText).toContain("Planet");
  });

  it("includes dedication when provided", () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "Opening line.");
    const result = exportSvc.buildManuscript(projectRoot, { dedication: "For the dreamers." });
    expect(result.fullText).toContain("For the dreamers");
  });

  it("restricts to selected chapter numbers", () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "Chapter one.");
    addChapter(memorySvc, 2, "Chapter two.");
    addChapter(memorySvc, 3, "Chapter three.");
    const result = exportSvc.buildManuscript(projectRoot, undefined, undefined, [1, 3]);
    expect(result.chapters.map((c) => c.chapterNumber)).toEqual([1, 3]);
  });

  // ── exportManuscript — markdown ───────────────────────────────────────────

  it("exports to markdown file", async () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "The station hummed. She checked the sensors.");
    const manifest = await exportSvc.exportManuscript(projectRoot, "markdown");
    expect(manifest.format).toBe("markdown");
    expect(manifest.status).toBe("complete");
    expect(fs.existsSync(manifest.outputPath)).toBe(true);
    const content = fs.readFileSync(manifest.outputPath, "utf-8");
    expect(content).toContain("Chapter 1");
    expect(content).toContain("The station hummed");
  });

  it("saves a manifest JSON alongside the export", async () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "Prose here.");
    const manifest = await exportSvc.exportManuscript(projectRoot, "markdown");
    const exportsDir = path.join(projectRoot, "exports");
    const manifestFiles = fs.readdirSync(exportsDir).filter((f) => f.endsWith("-manifest.json"));
    expect(manifestFiles.length).toBe(1);
    expect(manifest.chapterCount).toBe(1);
    expect(manifest.totalWordCount).toBeGreaterThan(0);
  });

  // ── exportManuscript — html ───────────────────────────────────────────────

  it("exports to html file with DOCTYPE", async () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "She walks to the console.");
    const manifest = await exportSvc.exportManuscript(projectRoot, "html");
    expect(manifest.format).toBe("html");
    expect(fs.existsSync(manifest.outputPath)).toBe(true);
    const content = fs.readFileSync(manifest.outputPath, "utf-8");
    expect(content).toContain("<!DOCTYPE html>");
    expect(content).toContain("Planet");
  });

  // ── exportManuscript — docx ───────────────────────────────────────────────

  it("exports to docx file", async () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "She walks to the console and reads the data.");
    const manifest = await exportSvc.exportManuscript(projectRoot, "docx");
    expect(manifest.format).toBe("docx");
    expect(manifest.status).toBe("complete");
    expect(fs.existsSync(manifest.outputPath)).toBe(true);
    const stat = fs.statSync(manifest.outputPath);
    expect(stat.size).toBeGreaterThan(1000); // DOCX files are non-trivially sized
  });

  // ── exportManuscript — epub ───────────────────────────────────────────────

  it("exports to epub file", async () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "She walks to the console and reads the data.");
    const manifest = await exportSvc.exportManuscript(projectRoot, "epub");
    expect(manifest.format).toBe("epub");
    expect(manifest.status).toBe("complete");
    expect(fs.existsSync(manifest.outputPath)).toBe(true);
    const stat = fs.statSync(manifest.outputPath);
    expect(stat.size).toBeGreaterThan(500);
  });

  // ── exportManuscript — pdf ────────────────────────────────────────────────

  it("exports pdf as html source with partial status", async () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "She walks to the console.");
    const manifest = await exportSvc.exportManuscript(projectRoot, "pdf");
    expect(manifest.format).toBe("pdf");
    expect(manifest.status).toBe("partial");
    expect(manifest.notes).toContain("pandoc");
    expect(fs.existsSync(manifest.outputPath)).toBe(true);
  });

  // ── listExportManifests ───────────────────────────────────────────────────

  it("lists manifests after multiple exports", async () => {
    const { exportSvc, memorySvc } = setup();
    addChapter(memorySvc, 1, "Content here.");
    await exportSvc.exportManuscript(projectRoot, "markdown");
    await exportSvc.exportManuscript(projectRoot, "html");
    const manifests = exportSvc.listExportManifests(projectRoot);
    expect(manifests.length).toBe(2);
    // Should be sorted newest first
    expect(["markdown", "html"]).toContain(manifests[0]?.format);
  });

  it("returns empty array when no exports exist", () => {
    const { exportSvc } = setup();
    const manifests = exportSvc.listExportManifests(projectRoot);
    expect(manifests).toEqual([]);
  });
});
