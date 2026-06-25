import { describe, it, expect, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathService } from "../src/services/path.service.js";

describe("PathService", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("allows paths inside an approved root", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-path-"));
    const svc = new PathService([tmpDir]);
    const resolved = svc.resolve(path.join(tmpDir, "project", "file.md"));
    expect(resolved).toBeTruthy();
  });

  it("blocks path traversal outside approved root", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-path-"));
    const svc = new PathService([tmpDir]);
    expect(() => svc.resolve(path.join(tmpDir, "..", "escape.txt"))).toThrow("Path safety violation");
  });

  it("atomicWrite creates file and removes tmp on success", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-path-"));
    const svc = new PathService([tmpDir]);
    const target = path.join(tmpDir, "output.txt");
    svc.atomicWrite(target, "hello");
    expect(fs.readFileSync(target, "utf-8")).toBe("hello");
    expect(fs.existsSync(target + ".tmp")).toBe(false);
  });

  it("findOrphanedTmp returns orphaned files", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-path-"));
    fs.writeFileSync(path.join(tmpDir, "bad.tmp"), "data");
    const svc = new PathService([tmpDir]);
    const orphans = svc.findOrphanedTmp(tmpDir);
    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toContain("bad.tmp");
  });
});
