import { describe, it, expect, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathService } from "../src/services/path.service.js";
import { AuditService } from "../src/services/audit.service.js";
import { ProjectService } from "../src/services/project.service.js";
import { MemoryService } from "../src/services/memory.service.js";
import { PlanningService } from "../src/services/planning.service.js";
import { DraftingService } from "../src/services/drafting.service.js";
import { ProjectSettings } from "../src/types/project.js";

function makeServices(tmpDir: string) {
  const pathSvc = new PathService([tmpDir]);
  const auditSvc = new AuditService(path.join(tmpDir, "logs"), 1);
  const projectSvc = new ProjectService(pathSvc, auditSvc);
  const memorySvc = new MemoryService(pathSvc, auditSvc);
  const planningSvc = new PlanningService(pathSvc, auditSvc);
  const draftingSvc = new DraftingService(pathSvc, auditSvc, memorySvc, planningSvc);
  return { pathSvc, auditSvc, projectSvc, memorySvc, planningSvc, draftingSvc };
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

describe("DraftingService", () => {
  let tmpDir: string;
  let projectRoot: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function setup() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-draft-"));
    const services = makeServices(tmpDir);
    const meta = services.projectSvc.create(baseSettings, tmpDir);
    projectRoot = meta.projectRoot;
    return { ...services, meta };
  }

  // ── assembleDraftContext ──────────────────────────────────────────────────

  it("assembles a draft context with defaults when project has no data", () => {
    const { draftingSvc } = setup();
    const ctx = draftingSvc.assembleDraftContext(projectRoot, 1);
    expect(ctx.chapterNumber).toBe(1);
    expect(ctx.chapterBrief).toBeUndefined();
    expect(ctx.previousChapterSummary).toBeUndefined();
    expect(ctx.activeCharacters).toContain("no characters defined");
    expect(ctx.styleGuideSummary).toContain("no style guide defined");
    expect(ctx.assembledAt).toBeTruthy();
  });

  it("includes character data in draft context when characters exist", () => {
    const { draftingSvc, memorySvc } = setup();
    memorySvc.upsertCharacter(projectRoot, {
      name: "Yael Orin",
      role: "protagonist",
      coreDesire: "save humanity",
      arc: "reluctant hero",
      keyFacts: ["Engineer", "Determined"],
      doNotWrite: [],
      aliases: [],
    });
    const ctx = draftingSvc.assembleDraftContext(projectRoot, 1);
    expect(ctx.activeCharacters).toContain("Yael Orin");
    expect(ctx.activeCharacters).toContain("protagonist");
  });

  it("includes previous chapter ending when chapter > 1 and prior draft exists", () => {
    const { draftingSvc, memorySvc } = setup();
    memorySvc.saveChapterVersion(projectRoot, 1, "Para one.\n\nPara two.\n\nPara three.\n\nPara four.", "first draft");
    const ctx = draftingSvc.assembleDraftContext(projectRoot, 2);
    expect(ctx.previousChapterSummary).toContain("End of Chapter 1");
  });

  // ── saveDraft ─────────────────────────────────────────────────────────────

  it("saves a chapter draft and returns version 1", () => {
    const { draftingSvc } = setup();
    const version = draftingSvc.saveDraft(projectRoot, 1, "The station hummed with energy.", "initial draft");
    expect(version.version).toBe(1);
    expect(version.chapterNumber).toBe(1);
    expect(version.wordCount).toBeGreaterThan(0);
    expect(fs.existsSync(version.filePath)).toBe(true);
  });

  it("increments version on repeated saves", () => {
    const { draftingSvc } = setup();
    draftingSvc.saveDraft(projectRoot, 1, "Draft one content.", "v1");
    const v2 = draftingSvc.saveDraft(projectRoot, 1, "Draft two content with more words here.", "v2");
    expect(v2.version).toBe(2);
  });

  // ── compareVersions ───────────────────────────────────────────────────────

  it("compares two versions and returns a VersionComparison", () => {
    const { draftingSvc } = setup();
    draftingSvc.saveDraft(projectRoot, 1, "Short draft.\n\nOnly two paragraphs.", "v1");
    draftingSvc.saveDraft(projectRoot, 1, "Short draft.\n\nOnly two paragraphs.\n\nA third paragraph added here.", "v2");
    const cmp = draftingSvc.compareVersions(projectRoot, 1, 1, 2);
    expect(cmp.versionA).toBe(1);
    expect(cmp.versionB).toBe(2);
    expect(cmp.wordCountDelta).toBeGreaterThan(0);
    expect(cmp.addedParagraphs).toBe(1);
    expect(cmp.summary).toContain("v1");
    expect(cmp.summary).toContain("v2");
  });

  it("throws when comparing non-existent version", () => {
    const { draftingSvc } = setup();
    draftingSvc.saveDraft(projectRoot, 1, "Only one version exists.", "v1");
    expect(() => draftingSvc.compareVersions(projectRoot, 1, 1, 99)).toThrow();
  });

  // ── getWordCountProgress ──────────────────────────────────────────────────

  it("returns zero progress when no drafts saved", () => {
    const { draftingSvc, meta } = setup();
    const progress = draftingSvc.getWordCountProgress(projectRoot, meta);
    expect(progress.targetWordCount).toBe(40000);
    expect(progress.actualWordCount).toBe(0);
    expect(progress.percentComplete).toBe(0);
  });

  it("accumulates word counts across chapters", () => {
    const { draftingSvc, meta } = setup();
    const words100 = Array(100).fill("word").join(" ");
    const words200 = Array(200).fill("word").join(" ");
    draftingSvc.saveDraft(projectRoot, 1, words100, "ch1");
    draftingSvc.saveDraft(projectRoot, 2, words200, "ch2");
    const progress = draftingSvc.getWordCountProgress(projectRoot, meta);
    expect(progress.actualWordCount).toBe(300);
    expect(progress.chapterBreakdown.length).toBeGreaterThanOrEqual(2);
  });

  // ── revision passes ───────────────────────────────────────────────────────

  it("saves a revision pass and retrieves it", () => {
    const { draftingSvc } = setup();
    const pass = draftingSvc.saveRevisionPass(
      projectRoot, "copy-edit", "Fix all typos", "chapter", 1, "host", 1
    );
    expect(pass.id).toBeTruthy();
    expect(pass.passType).toBe("copy-edit");
    expect(pass.approvalStatus).toBe("pending");

    const passes = draftingSvc.listRevisionPasses(projectRoot, 1);
    expect(passes.length).toBe(1);
    expect(passes[0]?.id).toBe(pass.id);
  });

  it("completes a revision pass with output version and summary", () => {
    const { draftingSvc } = setup();
    const pass = draftingSvc.saveRevisionPass(
      projectRoot, "proofread", "Final proofread", "chapter", 1, "host", 1
    );
    const completed = draftingSvc.completeRevisionPass(projectRoot, pass.id, 2, "Fixed 5 typos");
    expect(completed.outputVersion).toBe(2);
    expect(completed.changeSummary).toBe("Fixed 5 typos");
  });

  it("approves a revision pass", () => {
    const { draftingSvc } = setup();
    const pass = draftingSvc.saveRevisionPass(
      projectRoot, "dialogue", "Punch up dialogue", "chapter", 1, "host", 1
    );
    draftingSvc.completeRevisionPass(projectRoot, pass.id, 2, "Punched up dialogue");
    const approved = draftingSvc.approveRevisionPass(projectRoot, pass.id);
    expect(approved.approvalStatus).toBe("approved");
  });

  it("throws when completing a non-existent pass", () => {
    const { draftingSvc } = setup();
    expect(() => draftingSvc.completeRevisionPass(projectRoot, "bad-id", 2, "summary")).toThrow();
  });

  // ── expansion / condensation prompts ─────────────────────────────────────

  it("buildExpansionPrompt returns a string containing the passage", () => {
    const { draftingSvc } = setup();
    const passage = "She looked at the stars.";
    const prompt = draftingSvc.buildExpansionPrompt(passage, 100, "", "add more sensory detail");
    expect(prompt).toContain(passage);
    expect(prompt).toContain("100 words");
    expect(prompt).toContain("add more sensory detail");
  });

  it("buildCondensationPrompt returns a string containing the passage", () => {
    const { draftingSvc } = setup();
    const passage = "She looked at the stars for a very long time thinking about many things.";
    const prompt = draftingSvc.buildCondensationPrompt(passage, 10, "");
    expect(prompt).toContain(passage);
    expect(prompt).toContain("10 words");
  });
});
