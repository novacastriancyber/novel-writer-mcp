import { describe, it, expect, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathService } from "../src/services/path.service.js";
import { AuditService } from "../src/services/audit.service.js";
import { ProjectService } from "../src/services/project.service.js";
import { ProjectSettings } from "../src/types/project.js";

function makeServices(tmpDir: string) {
  const pathSvc = new PathService([tmpDir]);
  const auditSvc = new AuditService(path.join(tmpDir, "logs"), 1);
  const projectSvc = new ProjectService(pathSvc, auditSvc);
  return { pathSvc, auditSvc, projectSvc };
}

const baseSettings: ProjectSettings = {
  workingTitle: "The Dark Tower",
  genres: [{ genre: "fantasy", weight: 1.0 }],
  targetWordCount: 100000,
  contentRating: "PG-13",
  structureModel: "three-act",
  styleProfiles: [],
  pointOfView: "third-limited",
  tense: "past",
  setting: "Mid-World",
  exportTargets: ["markdown"],
  doNotUseList: [],
};

describe("ProjectService", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates a project folder with required subdirectories", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-proj-"));
    const { projectSvc } = makeServices(tmpDir);
    const meta = projectSvc.create(baseSettings, tmpDir);

    expect(meta.id).toBeTruthy();
    expect(meta.status).toBe("planning");
    expect(fs.existsSync(path.join(meta.projectRoot, "outline"))).toBe(true);
    expect(fs.existsSync(path.join(meta.projectRoot, "characters"))).toBe(true);
    expect(fs.existsSync(path.join(meta.projectRoot, "drafts"))).toBe(true);
    expect(fs.existsSync(path.join(meta.projectRoot, "memory", "archive"))).toBe(true);
    expect(fs.existsSync(path.join(meta.projectRoot, "project.json"))).toBe(true);
  });

  it("round-trips metadata through load", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-proj-"));
    const { projectSvc } = makeServices(tmpDir);
    const meta = projectSvc.create(baseSettings, tmpDir);
    const loaded = projectSvc.load(meta.projectRoot);
    expect(loaded.id).toBe(meta.id);
    expect(loaded.settings.workingTitle).toBe("The Dark Tower");
  });

  it("lists projects in a directory", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-proj-"));
    const { projectSvc } = makeServices(tmpDir);
    projectSvc.create(baseSettings, tmpDir);
    projectSvc.create({ ...baseSettings, workingTitle: "IT" }, tmpDir);
    const list = projectSvc.list(tmpDir);
    expect(list).toHaveLength(2);
  });

  it("updates project status", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-proj-"));
    const { projectSvc } = makeServices(tmpDir);
    const meta = projectSvc.create(baseSettings, tmpDir);
    projectSvc.updateStatus(meta, "drafting");
    const loaded = projectSvc.load(meta.projectRoot);
    expect(loaded.status).toBe("drafting");
  });

  it("throws when loading a directory without project.json", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-proj-"));
    const { projectSvc } = makeServices(tmpDir);
    const emptyDir = path.join(tmpDir, "empty");
    fs.mkdirSync(emptyDir);
    expect(() => projectSvc.load(emptyDir)).toThrow("No project.json");
  });
});
