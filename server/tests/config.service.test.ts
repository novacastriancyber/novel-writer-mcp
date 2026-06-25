import { describe, it, expect } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConfigService } from "../src/services/config.service.js";

function writeTempConfig(obj: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-test-"));
  const file = path.join(dir, "config.json");
  fs.writeFileSync(file, JSON.stringify(obj), "utf-8");
  return file;
}

describe("ConfigService", () => {
  it("loads defaults when no config file exists", () => {
    const svc = new ConfigService(path.join(os.tmpdir(), "nonexistent-novel.json"));
    const cfg = svc.get();
    expect(cfg.contentRating).toBe("PG-13");
    expect(cfg.approvedRoots).toEqual([]);
  });

  it("merges file config over defaults", () => {
    const file = writeTempConfig({ contentRating: "R", logRetentionDays: 30, approvedRoots: [] });
    const svc = new ConfigService(file);
    expect(svc.get().contentRating).toBe("R");
    expect(svc.get().logRetentionDays).toBe(30);
  });

  it("throws on invalid contentRating", () => {
    const file = writeTempConfig({ contentRating: "X", approvedRoots: [] });
    expect(() => new ConfigService(file)).toThrow("contentRating");
  });

  it("throws on relative approvedRoot", () => {
    const file = writeTempConfig({ approvedRoots: ["relative/path"] });
    expect(() => new ConfigService(file)).toThrow("absolute");
  });

  it("isApprovedRoot returns true for a path inside an approved root", () => {
    const tmpDir = os.tmpdir();
    const file = writeTempConfig({ approvedRoots: [tmpDir] });
    const svc = new ConfigService(file);
    expect(svc.isApprovedRoot(path.join(tmpDir, "subdir", "file.txt"))).toBe(true);
  });

  it("isApprovedRoot returns false for a path outside approved roots", () => {
    const file = writeTempConfig({ approvedRoots: ["C:\\approved"] });
    const svc = new ConfigService(file);
    expect(svc.isApprovedRoot("C:\\other\\file.txt")).toBe(false);
  });
});
