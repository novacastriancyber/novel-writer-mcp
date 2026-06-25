import path from "node:path";
import fs from "node:fs";

export class PathService {
  private approvedRoots: string[];

  constructor(approvedRoots: string[]) {
    this.approvedRoots = approvedRoots.map((r) => path.resolve(r));
  }

  /**
   * Resolve a path and verify it is inside an approved root.
   * Throws if the path traverses outside approved roots.
   */
  resolve(inputPath: string): string {
    const resolved = path.resolve(inputPath);
    if (!this.isApproved(resolved)) {
      throw new Error(
        `Path safety violation: "${resolved}" is outside all approved project roots.`
      );
    }
    return resolved;
  }

  isApproved(resolvedPath: string): boolean {
    return this.approvedRoots.some((root) => {
      const rel = path.relative(root, resolvedPath);
      return !rel.startsWith("..") && !path.isAbsolute(rel);
    });
  }

  /**
   * Write file atomically: write to .tmp, validate it exists, then rename.
   */
  atomicWrite(filePath: string, content: string): void {
    const resolved = this.resolve(filePath);
    const tmp = resolved + ".tmp";
    try {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(tmp, content, "utf-8");
      fs.renameSync(tmp, resolved);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch { /* ignore cleanup failure */ }
      throw err;
    }
  }

  /**
   * Scan for orphaned .tmp files left by a crashed write.
   */
  findOrphanedTmp(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const results: string[] = [];
    const scan = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) scan(full);
        else if (entry.name.endsWith(".tmp")) results.push(full);
      }
    };
    scan(dir);
    return results;
  }

  join(...parts: string[]): string {
    return path.join(...parts);
  }
}
