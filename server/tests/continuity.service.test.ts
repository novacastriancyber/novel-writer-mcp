import { describe, it, expect, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathService } from "../src/services/path.service.js";
import { AuditService } from "../src/services/audit.service.js";
import { ProjectService } from "../src/services/project.service.js";
import { MemoryService } from "../src/services/memory.service.js";
import { PlanningService } from "../src/services/planning.service.js";
import { ContinuityService } from "../src/services/continuity.service.js";
import { ProjectSettings } from "../src/types/project.js";

function makeServices(tmpDir: string) {
  const pathSvc = new PathService([tmpDir]);
  const auditSvc = new AuditService(path.join(tmpDir, "logs"), 1);
  const projectSvc = new ProjectService(pathSvc, auditSvc);
  const memorySvc = new MemoryService(pathSvc, auditSvc);
  const planningSvc = new PlanningService(pathSvc, auditSvc);
  const continuitySvc = new ContinuityService(pathSvc, auditSvc, memorySvc, planningSvc);
  return { pathSvc, auditSvc, projectSvc, memorySvc, planningSvc, continuitySvc };
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

describe("ContinuityService", () => {
  let tmpDir: string;
  let projectRoot: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function setup() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-cont-"));
    const services = makeServices(tmpDir);
    const meta = services.projectSvc.create(baseSettings, tmpDir);
    projectRoot = meta.projectRoot;
    return { ...services, meta };
  }

  // ── checkContinuity ───────────────────────────────────────────────────────

  it("passes continuity check on an empty project", () => {
    const { continuitySvc } = setup();
    const report = continuitySvc.checkContinuity(projectRoot);
    expect(report.passed).toBe(true);
    expect(report.blockingCount).toBe(0);
  });

  it("detects duplicate character names", () => {
    const { continuitySvc, memorySvc } = setup();
    memorySvc.upsertCharacter(projectRoot, { name: "Yael Orin", role: "protagonist", keyFacts: [], doNotWrite: [], aliases: [] });
    memorySvc.upsertCharacter(projectRoot, { name: "Yael Orin", role: "supporting", keyFacts: [], doNotWrite: [], aliases: [] });
    const report = continuitySvc.checkContinuity(projectRoot);
    expect(report.issues.some((i) => i.category === "character-name")).toBe(true);
  });

  it("flags a missing draft as blocking when checking up to chapter 2", () => {
    const { continuitySvc, planningSvc } = setup();
    planningSvc.saveChapterBrief(projectRoot, {
      chapterNumber: 1, title: "Departure", povCharacter: "Yael",
      location: "Station", dramaticQuestion: "Will they launch?",
      goal: "Launch", outcome: "Launch", continuityItems: [], sceneBriefs: [],
    });
    // No draft saved for chapter 1
    const report = continuitySvc.checkContinuity(projectRoot, 2);
    expect(report.issues.some((i) => i.severity === "blocking" && i.category === "missing-draft")).toBe(true);
    expect(report.passed).toBe(false);
  });

  it("saves a report file to the reports directory", () => {
    const { continuitySvc } = setup();
    continuitySvc.checkContinuity(projectRoot);
    const reportsDir = path.join(projectRoot, "reports");
    expect(fs.existsSync(reportsDir)).toBe(true);
    const files = fs.readdirSync(reportsDir).filter((f) => f.startsWith("continuity-"));
    expect(files.length).toBeGreaterThan(0);
  });

  // ── checkChapterReadiness ─────────────────────────────────────────────────

  it("blocks chapter 1 readiness when no brief exists", () => {
    const { continuitySvc } = setup();
    const report = continuitySvc.checkChapterReadiness(projectRoot, 1);
    expect(report.ready).toBe(false);
    expect(report.blockingIssues.some((i) => i.category === "missing-brief")).toBe(true);
  });

  it("reports ready when brief exists and no blocking issues", () => {
    const { continuitySvc, planningSvc } = setup();
    planningSvc.saveChapterBrief(projectRoot, {
      chapterNumber: 1, title: "Departure", povCharacter: "Yael",
      location: "Station", dramaticQuestion: "Will they launch?",
      goal: "Launch", outcome: "Launch", continuityItems: [], sceneBriefs: [],
    });
    const report = continuitySvc.checkChapterReadiness(projectRoot, 1);
    expect(report.ready).toBe(true);
  });

  it("overrides blocking issues when overrideApproved is true", () => {
    const { continuitySvc } = setup();
    // No brief — would be blocking — but override set
    const report = continuitySvc.checkChapterReadiness(projectRoot, 1, true);
    expect(report.ready).toBe(true);
    expect(report.summary).toContain("override");
  });

  // ── checkStyleConsistency ─────────────────────────────────────────────────

  it("returns passed=true when no draft exists", () => {
    const { continuitySvc } = setup();
    const report = continuitySvc.checkStyleConsistency(projectRoot, 1);
    expect(report.passed).toBe(true);
    expect(report.issues.length).toBe(0);
  });

  it("detects do-not-use word violations in draft text", () => {
    const { continuitySvc, memorySvc, planningSvc } = setup();
    planningSvc.saveStyleGuide(projectRoot, {
      profiles: [],
      tenseNotes: "present tense",
      povNotes: "third-limited",
      sentenceRhythm: "",
      paragraphLength: "",
      dialogueStyle: "",
      descriptionDensity: "",
      vocabularyLevel: "",
      doNotUseList: ["suddenly"],
    });
    memorySvc.saveChapterVersion(projectRoot, 1, "She suddenly looked up. He suddenly moved.", "v1");
    const report = continuitySvc.checkStyleConsistency(projectRoot, 1);
    expect(report.issues.some((i) => i.ruleViolated.includes("suddenly"))).toBe(true);
  });

  // ── checkGenreContract ────────────────────────────────────────────────────

  it("skips genre contract check when no contract defined", () => {
    const { continuitySvc } = setup();
    const report = continuitySvc.checkGenreContract(projectRoot);
    expect(report.passed).toBe(true);
    expect(report.issues.length).toBe(0);
  });

  it("skips genre contract check when no drafts exist", () => {
    const { continuitySvc, planningSvc } = setup();
    planningSvc.saveGenreContract(
      projectRoot,
      ["sci-fi"],
      [{ promise: "spaceship appears", mandatory: true }],
      ["tension", "scientific accuracy"],
      []
    );
    const report = continuitySvc.checkGenreContract(projectRoot);
    expect(report.passed).toBe(true);
    expect(report.summary).toContain("skipped");
  });

  // ── checkPacing ───────────────────────────────────────────────────────────

  it("returns empty chapter list when no drafts exist", () => {
    const { continuitySvc } = setup();
    const report = continuitySvc.checkPacing(projectRoot);
    expect(report.chapters.length).toBe(0);
    expect(report.overallNotes.some((n) => n.includes("skipped"))).toBe(true);
  });

  it("analyses pacing for a drafted chapter", () => {
    const { continuitySvc, memorySvc } = setup();
    const content = Array(20).fill("She walks to the console and checks the readings.").join("\n\n");
    memorySvc.saveChapterVersion(projectRoot, 1, content, "v1");
    const report = continuitySvc.checkPacing(projectRoot);
    expect(report.chapters.length).toBe(1);
    expect(report.chapters[0]?.chapterNumber).toBe(1);
    expect(report.chapters[0]?.wordCount).toBeGreaterThan(0);
    expect(["fast", "moderate", "slow"]).toContain(report.chapters[0]?.pacingLabel);
  });

  it("labels a dialogue-heavy chapter as fast", () => {
    const { continuitySvc, memorySvc } = setup();
    const dialogueParas = Array(20).fill('"Are we ready?" she asks.\n\n"Yes," he replies.').join("\n\n");
    memorySvc.saveChapterVersion(projectRoot, 1, dialogueParas, "v1");
    const report = continuitySvc.checkPacing(projectRoot);
    expect(report.chapters[0]?.pacingLabel).toBe("fast");
  });
});
