import { describe, it, expect, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathService } from "../src/services/path.service.js";

describe("PathService – path safety hardening", () => {
  let tmpDir: string;
  let outsideDir: string;

  afterEach(() => {
    for (const d of [tmpDir, outsideDir]) {
      if (d && fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
    }
  });

  function setup() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-safety-"));
    outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-outside-"));
    return new PathService([tmpDir]);
  }

  // ── Traversal attacks ──────────────────────────────────────────────────────

  it("blocks single dot-dot traversal", () => {
    const svc = setup();
    const evil = path.join(tmpDir, "..", path.basename(outsideDir), "secret.txt");
    expect(() => svc.resolve(evil)).toThrow("Path safety violation");
  });

  it("blocks deep dot-dot traversal", () => {
    const svc = setup();
    const deep = path.join(tmpDir, "a", "b", "c", "..", "..", "..", "..", "etc", "passwd");
    expect(() => svc.resolve(deep)).toThrow("Path safety violation");
  });

  it("blocks absolute path outside any approved root", () => {
    const svc = setup();
    const absolute = outsideDir;
    expect(() => svc.resolve(absolute)).toThrow("Path safety violation");
  });

  it("blocks path whose prefix matches but goes beyond root", () => {
    // Regression: if root is /tmp/novel-abc, /tmp/novel-abcXXX should NOT be approved
    const tricky = tmpDir + "extension";
    const svc = setup();
    expect(() => svc.resolve(tricky)).toThrow("Path safety violation");
  });

  it("blocks write via atomicWrite to path outside root", () => {
    const svc = setup();
    const evil = path.join(outsideDir, "malicious.txt");
    expect(() => svc.atomicWrite(evil, "data")).toThrow("Path safety violation");
  });

  // ── Approved paths ─────────────────────────────────────────────────────────

  it("allows deeply nested path inside root", () => {
    const svc = setup();
    const nested = path.join(tmpDir, "a", "b", "c", "file.md");
    expect(() => svc.resolve(nested)).not.toThrow();
    expect(svc.resolve(nested)).toBe(path.resolve(nested));
  });

  it("allows path that is exactly the root", () => {
    const svc = setup();
    expect(() => svc.resolve(tmpDir)).not.toThrow();
  });

  // ── Multiple approved roots ────────────────────────────────────────────────

  it("allows path inside second approved root", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-safety-"));
    outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-outside-"));
    const secondRoot = fs.mkdtempSync(path.join(os.tmpdir(), "novel-root2-"));
    const svc = new PathService([tmpDir, secondRoot]);
    const inSecond = path.join(secondRoot, "project", "file.md");
    expect(() => svc.resolve(inSecond)).not.toThrow();
    fs.rmSync(secondRoot, { recursive: true, force: true });
  });

  it("blocks path that is inside none of multiple approved roots", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-safety-"));
    outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-outside-"));
    const secondRoot = fs.mkdtempSync(path.join(os.tmpdir(), "novel-root2-"));
    const svc = new PathService([tmpDir, secondRoot]);
    const inNeither = path.join(outsideDir, "file.md");
    expect(() => svc.resolve(inNeither)).toThrow("Path safety violation");
    fs.rmSync(secondRoot, { recursive: true, force: true });
  });

  // ── isApproved ─────────────────────────────────────────────────────────────

  it("isApproved returns false for path outside root", () => {
    const svc = setup();
    expect(svc.isApproved(outsideDir)).toBe(false);
  });

  it("isApproved returns true for path inside root", () => {
    const svc = setup();
    expect(svc.isApproved(path.join(tmpDir, "novels", "my-book"))).toBe(true);
  });

  // ── Atomic write safety ────────────────────────────────────────────────────

  it("atomicWrite leaves no .tmp on success", () => {
    const svc = setup();
    const target = path.join(tmpDir, "output.txt");
    svc.atomicWrite(target, "content");
    expect(fs.existsSync(target + ".tmp")).toBe(false);
    expect(fs.readFileSync(target, "utf-8")).toBe("content");
  });

  it("atomicWrite creates parent directories", () => {
    const svc = setup();
    const nested = path.join(tmpDir, "deep", "nested", "dir", "file.txt");
    svc.atomicWrite(nested, "hello");
    expect(fs.existsSync(nested)).toBe(true);
  });

  it("atomicWrite overwrites existing file safely", () => {
    const svc = setup();
    const target = path.join(tmpDir, "data.txt");
    svc.atomicWrite(target, "v1");
    svc.atomicWrite(target, "v2");
    expect(fs.readFileSync(target, "utf-8")).toBe("v2");
  });
});
