import { describe, it, expect, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathService } from "../src/services/path.service.js";
import { AuditService } from "../src/services/audit.service.js";
import { ProjectService } from "../src/services/project.service.js";
import { PlanningService } from "../src/services/planning.service.js";
import { ProjectSettings } from "../src/types/project.js";

function makeServices(tmpDir: string) {
  const pathSvc = new PathService([tmpDir]);
  const auditSvc = new AuditService(path.join(tmpDir, "logs"), 1);
  const projectSvc = new ProjectService(pathSvc, auditSvc);
  const planningSvc = new PlanningService(pathSvc, auditSvc);
  return { pathSvc, auditSvc, projectSvc, planningSvc };
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

describe("PlanningService", () => {
  let tmpDir: string;
  let projectRoot: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function setup() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-plan-"));
    const { projectSvc, planningSvc } = makeServices(tmpDir);
    const meta = projectSvc.create(baseSettings, tmpDir);
    projectRoot = meta.projectRoot;
    return { projectSvc, planningSvc, meta };
  }

  // ── Premise ─────────────────────────────────────────────────────────────

  it("saves and retrieves a premise", () => {
    const { planningSvc } = setup();
    const saved = planningSvc.savePremise(projectRoot, "Original idea", "Dr Yael wants to build a planet.", "An engineer races to build humanity a new home.");
    expect(saved.version).toBe(1);
    const retrieved = planningSvc.getPremise(projectRoot);
    expect(retrieved?.logline).toBe("An engineer races to build humanity a new home.");
  });

  it("archives previous premise on update", () => {
    const { planningSvc } = setup();
    planningSvc.savePremise(projectRoot, "Idea", "Premise v1", "Logline v1");
    planningSvc.savePremise(projectRoot, "Idea", "Premise v2", "Logline v2");
    const plan = planningSvc.load(projectRoot);
    expect(plan.premise?.version).toBe(2);
    const archiveDir = path.join(projectRoot, "memory", "archive");
    const files = fs.readdirSync(archiveDir);
    expect(files.some((f) => f.includes("premise"))).toBe(true);
  });

  // ── Synopsis ────────────────────────────────────────────────────────────

  it("saves short and full synopses independently", () => {
    const { planningSvc } = setup();
    planningSvc.saveSynopsis(projectRoot, "short", "Short version.");
    planningSvc.saveSynopsis(projectRoot, "full", "Full version with more detail.");
    expect(planningSvc.getSynopsis(projectRoot, "short")?.content).toBe("Short version.");
    expect(planningSvc.getSynopsis(projectRoot, "full")?.content).toBe("Full version with more detail.");
  });

  it("writes synopsis to outline folder", () => {
    const { planningSvc } = setup();
    planningSvc.saveSynopsis(projectRoot, "short", "Short synopsis content");
    const outlineDir = path.join(projectRoot, "outline");
    const files = fs.readdirSync(outlineDir);
    expect(files.some((f) => f.includes("synopsis-short"))).toBe(true);
  });

  // ── Genre Contract ───────────────────────────────────────────────────────

  it("saves a genre contract", () => {
    const { planningSvc } = setup();
    const contract = planningSvc.saveGenreContract(
      projectRoot,
      ["science-fiction"],
      [{ promise: "Science must be plausible", mandatory: true }],
      ["Expect speculative technology"],
      ["Avoid chosen-one tropes"]
    );
    expect(contract.version).toBe(1);
    expect(contract.promises).toHaveLength(1);
    const styleDir = path.join(projectRoot, "style");
    expect(fs.existsSync(path.join(styleDir, "genre-contract-v1.json"))).toBe(true);
  });

  // ── Style Guide ──────────────────────────────────────────────────────────

  it("saves a style guide", () => {
    const { planningSvc } = setup();
    const guide = planningSvc.saveStyleGuide(projectRoot, {
      profiles: [{ name: "Neutral technical", traits: ["precise", "dry"], sourceNotes: "" }],
      sentenceRhythm: "Medium, varied",
      paragraphLength: "Short to medium",
      dialogueStyle: "Sparse, functional",
      descriptionDensity: "Low",
      povNotes: "Third limited — Yael only",
      tenseNotes: "Present tense throughout",
      vocabularyLevel: "Professional, accessible",
      doNotUseList: ["suddenly", "beautiful eyes"],
    });
    expect(guide.version).toBe(1);
    expect(guide.doNotUseList).toContain("suddenly");
  });

  // ── Structure ────────────────────────────────────────────────────────────

  it("returns built-in three-act template", () => {
    const { planningSvc } = setup();
    const acts = planningSvc.getStructureTemplate("three-act");
    expect(acts).toHaveLength(3);
    expect(acts[0].name).toContain("Act One");
  });

  it("saves a structure plan", () => {
    const { planningSvc } = setup();
    const acts = planningSvc.getStructureTemplate("three-act");
    const plan = planningSvc.saveStructurePlan(projectRoot, "three-act", acts, 15);
    expect(plan.totalChapters).toBe(15);
    expect(plan.acts).toHaveLength(3);
    expect(fs.existsSync(path.join(projectRoot, "outline", "structure-v1.json"))).toBe(true);
  });

  // ── Chapter Briefs ───────────────────────────────────────────────────────

  it("saves and retrieves chapter briefs in order", () => {
    const { planningSvc } = setup();
    planningSvc.saveChapterBrief(projectRoot, { chapterNumber: 3, title: "Chapter Three", povCharacter: "Yael", location: "Earth", dramaticQuestion: "Will she agree?", goal: "Refuse the offer", outcome: "Refuses", continuityItems: [], sceneCount: 3 });
    planningSvc.saveChapterBrief(projectRoot, { chapterNumber: 1, title: "Chapter One", povCharacter: "Yael", location: "Eos", dramaticQuestion: "Is Eos ready?", goal: "Assess Eos", outcome: "Sets launch clock", continuityItems: [], sceneCount: 2 });
    const briefs = planningSvc.listChapterBriefs(projectRoot);
    expect(briefs[0].chapterNumber).toBe(1);
    expect(briefs[1].chapterNumber).toBe(3);
  });

  it("updates a chapter brief and increments version", () => {
    const { planningSvc } = setup();
    planningSvc.saveChapterBrief(projectRoot, { chapterNumber: 1, title: "Old title", povCharacter: "Yael", location: "Eos", dramaticQuestion: "Q", goal: "G", outcome: "O", continuityItems: [], sceneCount: 2 });
    const updated = planningSvc.saveChapterBrief(projectRoot, { chapterNumber: 1, title: "New title", povCharacter: "Yael", location: "Eos", dramaticQuestion: "Q", goal: "G", outcome: "O", continuityItems: [], sceneCount: 2 });
    expect(updated.version).toBe(2);
    expect(updated.title).toBe("New title");
  });

  // ── Scene Briefs ─────────────────────────────────────────────────────────

  it("saves multiple scenes per chapter", () => {
    const { planningSvc } = setup();
    planningSvc.saveSceneBrief(projectRoot, { chapterNumber: 1, sceneNumber: 1, title: "S1", povCharacter: "Yael", location: "Plain", goal: "Walk", conflict: "Nitrogen", outcome: "Sets clock", hook: "", endHook: "", wordCountTarget: 800 });
    planningSvc.saveSceneBrief(projectRoot, { chapterNumber: 1, sceneNumber: 2, title: "S2", povCharacter: "Yael", location: "City", goal: "Inspect", conflict: "Unease", outcome: "Returns", hook: "", endHook: "", wordCountTarget: 700 });
    const scenes = planningSvc.listScenesForChapter(projectRoot, 1);
    expect(scenes).toHaveLength(2);
    expect(scenes[0].sceneNumber).toBe(1);
  });

  // ── Draft Readiness ──────────────────────────────────────────────────────

  it("reports missing items when plan is empty", () => {
    const { planningSvc } = setup();
    const result = planningSvc.checkDraftReadiness(projectRoot);
    expect(result.ready).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("reports ready when all required items are present", () => {
    const { planningSvc } = setup();
    planningSvc.savePremise(projectRoot, "Idea", "Premise", "Logline");
    planningSvc.saveSynopsis(projectRoot, "short", "Short synopsis");
    planningSvc.saveGenreContract(projectRoot, ["sci-fi"], [{ promise: "P1", mandatory: true }], [], []);
    planningSvc.saveStyleGuide(projectRoot, { profiles: [], sentenceRhythm: "", paragraphLength: "", dialogueStyle: "", descriptionDensity: "", povNotes: "", tenseNotes: "", vocabularyLevel: "", doNotUseList: ["test"] });
    planningSvc.saveStructurePlan(projectRoot, "three-act", planningSvc.getStructureTemplate("three-act"), 15);
    planningSvc.saveChapterBrief(projectRoot, { chapterNumber: 1, title: "Ch1", povCharacter: "Y", location: "Eos", dramaticQuestion: "Q", goal: "G", outcome: "O", continuityItems: [], sceneCount: 2 });
    const result = planningSvc.checkDraftReadiness(projectRoot);
    expect(result.ready).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
});
