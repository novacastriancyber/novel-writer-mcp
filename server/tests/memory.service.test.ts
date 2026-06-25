import { describe, it, expect, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathService } from "../src/services/path.service.js";
import { AuditService } from "../src/services/audit.service.js";
import { MemoryService } from "../src/services/memory.service.js";
import { ProjectService } from "../src/services/project.service.js";
import { ProjectSettings } from "../src/types/project.js";

function makeServices(tmpDir: string) {
  const pathSvc = new PathService([tmpDir]);
  const auditSvc = new AuditService(path.join(tmpDir, "logs"), 1);
  const projectSvc = new ProjectService(pathSvc, auditSvc);
  const memorySvc = new MemoryService(pathSvc, auditSvc);
  return { pathSvc, auditSvc, projectSvc, memorySvc };
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

describe("MemoryService", () => {
  let tmpDir: string;
  let projectRoot: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function setup() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-mem-"));
    const { projectSvc, memorySvc } = makeServices(tmpDir);
    const meta = projectSvc.create(baseSettings, tmpDir);
    projectRoot = meta.projectRoot;
    return { projectSvc, memorySvc, meta };
  }

  // ── Characters ─────────────────────────────────────────────────────────

  it("creates a character with auto-generated id", () => {
    const { memorySvc } = setup();
    const char = memorySvc.upsertCharacter(projectRoot, {
      name: "Yael Orin",
      role: "protagonist",
      aliases: [],
      physicalDescription: "Compact",
      voice: "Dry",
      coreDesire: "Solve the problem",
      relationships: {},
      keyFacts: [],
      doNotWrite: [],
    });
    expect(char.id).toMatch(/^char-/);
    expect(char.version).toBe(1);
    expect(char.status).toBe("active");
  });

  it("increments version on update and archives prior version", () => {
    const { memorySvc } = setup();
    const char = memorySvc.upsertCharacter(projectRoot, {
      name: "Yael Orin", role: "protagonist", aliases: [], physicalDescription: "",
      voice: "", coreDesire: "", relationships: {}, keyFacts: [], doNotWrite: [],
    });
    const updated = memorySvc.upsertCharacter(projectRoot, {
      id: char.id,
      name: "Yael Orin", role: "protagonist", aliases: [], physicalDescription: "Updated",
      voice: "", coreDesire: "", relationships: {}, keyFacts: [], doNotWrite: [],
    });
    expect(updated.version).toBe(2);
    const archived = memorySvc.listArchivedRecords(projectRoot);
    expect(archived.some((f) => f.includes(char.id))).toBe(true);
  });

  it("archives a character without deleting it", () => {
    const { memorySvc } = setup();
    const char = memorySvc.upsertCharacter(projectRoot, {
      name: "Minor", role: "minor", aliases: [], physicalDescription: "",
      voice: "", coreDesire: "", relationships: {}, keyFacts: [], doNotWrite: [],
    });
    memorySvc.archiveCharacter(projectRoot, char.id);
    const memory = memorySvc.load(projectRoot);
    expect(memory.characters[char.id].status).toBe("archived");
  });

  // ── Plot Threads ────────────────────────────────────────────────────────

  it("creates and lists open plot threads", () => {
    const { memorySvc } = setup();
    memorySvc.upsertThread(projectRoot, {
      title: "Nitrogen variance",
      description: "Atmospheric issue",
      threadStatus: "open",
      obligatedBy: [],
      relatedCharacters: [],
      relatedLocations: [],
      notes: "",
    });
    memorySvc.upsertThread(projectRoot, {
      title: "Voss embargo",
      description: "Trade threat",
      threadStatus: "open",
      obligatedBy: [],
      relatedCharacters: [],
      relatedLocations: [],
      notes: "",
    });
    const open = memorySvc.listOpenThreads(projectRoot);
    expect(open).toHaveLength(2);
  });

  it("resolved threads are excluded from open list", () => {
    const { memorySvc } = setup();
    const t = memorySvc.upsertThread(projectRoot, {
      title: "Resolved thread", description: "", threadStatus: "open",
      obligatedBy: [], relatedCharacters: [], relatedLocations: [], notes: "",
    });
    memorySvc.upsertThread(projectRoot, {
      id: t.id, title: "Resolved thread", description: "", threadStatus: "resolved",
      obligatedBy: [], relatedCharacters: [], relatedLocations: [], notes: "",
    });
    expect(memorySvc.listOpenThreads(projectRoot)).toHaveLength(0);
  });

  // ── Continuity ──────────────────────────────────────────────────────────

  it("records and retrieves continuity facts by chapter", () => {
    const { memorySvc } = setup();
    memorySvc.addContinuityFact(projectRoot, {
      fact: "Nitrogen variance is 0.3%",
      establishedInChapter: 1,
      category: "world",
      relatedEntityIds: [],
    });
    memorySvc.addContinuityFact(projectRoot, {
      fact: "Yael sets launch clock at 90 days",
      establishedInChapter: 1,
      category: "timeline",
      relatedEntityIds: [],
    });
    memorySvc.addContinuityFact(projectRoot, {
      fact: "Voss threatens resupply",
      establishedInChapter: 2,
      category: "character",
      relatedEntityIds: [],
    });
    const ch1Facts = memorySvc.getContinuityByChapter(projectRoot, 1);
    expect(ch1Facts).toHaveLength(2);
    const ch2Facts = memorySvc.getContinuityByChapter(projectRoot, 2);
    expect(ch2Facts).toHaveLength(3);
  });

  // ── Versioning ──────────────────────────────────────────────────────────

  it("saves chapter versions with incrementing numbers", () => {
    const { memorySvc } = setup();
    const v1 = memorySvc.saveChapterVersion(projectRoot, 1, "Draft one content", "first pass");
    expect(v1.version).toBe(1);
    expect(v1.chapterNumber).toBe(1);
    expect(fs.existsSync(v1.filePath)).toBe(true);

    const v2 = memorySvc.saveChapterVersion(projectRoot, 1, "Draft two content", "second pass");
    expect(v2.version).toBe(2);
  });

  it("approves a chapter version", () => {
    const { memorySvc } = setup();
    const v = memorySvc.saveChapterVersion(projectRoot, 1, "Content");
    expect(v.approved).toBe(false);
    memorySvc.approveChapterVersion(projectRoot, 1, v.version);
    const memory = memorySvc.load(projectRoot);
    const approved = memory.chapterVersions.find((cv) => cv.chapterNumber === 1 && cv.version === v.version);
    expect(approved?.approved).toBe(true);
  });

  it("saves outline versions", () => {
    const { memorySvc } = setup();
    const v = memorySvc.saveOutlineVersion(projectRoot, "# Outline content", "initial");
    expect(v.version).toBe(1);
    expect(fs.existsSync(v.filePath)).toBe(true);
  });

  it("word count is calculated from content", () => {
    const { memorySvc } = setup();
    const v = memorySvc.saveChapterVersion(projectRoot, 1, "one two three four five");
    expect(v.wordCount).toBe(5);
  });
});
