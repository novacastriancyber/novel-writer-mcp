import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PathService } from "./path.service.js";
import { AuditService } from "./audit.service.js";
import { MemoryService } from "./memory.service.js";
import {
  ImportFormat,
  ImportTarget,
  ImportPreview,
  ImportSection,
  ImportRecord,
  SourceType,
} from "../types/import.js";

const PENDING_DIR = "memory/imports";

export class ImportService {
  constructor(
    private pathService: PathService,
    private audit: AuditService,
    private memoryService: MemoryService
  ) {}

  // ── Preview ──────────────────────────────────────────────────────────────

  async preview(
    projectRoot: string,
    sourceFile: string,
    target: ImportTarget,
    sourceType: SourceType
  ): Promise<ImportPreview> {
    const resolvedSource = this.pathService.resolve(sourceFile);
    const format = this.detectFormat(resolvedSource);
    const extractedText = await this.extract(resolvedSource, format);
    const sections = this.detectSections(extractedText);
    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

    const preview: ImportPreview = {
      id: `import-${crypto.randomUUID().slice(0, 8)}`,
      sourceFile: resolvedSource,
      format,
      target,
      extractedText,
      wordCount,
      detectedSections: sections,
      sourceType,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const pendingDir = path.join(projectRoot, PENDING_DIR);
    fs.mkdirSync(pendingDir, { recursive: true });
    this.pathService.atomicWrite(
      path.join(pendingDir, `${preview.id}.json`),
      JSON.stringify(preview, null, 2)
    );

    this.audit.log({
      type: "file_read",
      filePath: resolvedSource,
      outcome: "success",
      details: { importId: preview.id, format, target, wordCount },
    });

    return preview;
  }

  // ── Confirm ──────────────────────────────────────────────────────────────

  confirm(projectRoot: string, importId: string, citation?: string): ImportRecord {
    const preview = this.loadPending(projectRoot, importId);
    if (preview.status !== "pending") {
      throw new Error(`Import ${importId} is already ${preview.status}`);
    }

    const savedTo = this.commitImport(projectRoot, preview, citation);

    preview.status = "confirmed";
    this.savePending(projectRoot, preview);

    const record: ImportRecord = {
      id: preview.id,
      sourceFile: preview.sourceFile,
      format: preview.format,
      target: preview.target,
      wordCount: preview.wordCount,
      sourceType: preview.sourceType,
      confirmedAt: new Date().toISOString(),
      savedTo,
    };

    this.audit.log({
      type: "file_write",
      filePath: savedTo,
      outcome: "success",
      details: { importId, target: preview.target },
    });

    return record;
  }

  // ── Reject ───────────────────────────────────────────────────────────────

  reject(projectRoot: string, importId: string): void {
    const preview = this.loadPending(projectRoot, importId);
    if (preview.status !== "pending") {
      throw new Error(`Import ${importId} is already ${preview.status}`);
    }
    preview.status = "rejected";
    this.savePending(projectRoot, preview);
    this.audit.log({ type: "file_read", filePath: preview.sourceFile, outcome: "blocked", details: { importId, reason: "rejected by author" } });
  }

  // ── List pending ─────────────────────────────────────────────────────────

  listPending(projectRoot: string): ImportPreview[] {
    const pendingDir = path.join(projectRoot, PENDING_DIR);
    if (!fs.existsSync(pendingDir)) return [];
    return fs.readdirSync(pendingDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(pendingDir, f), "utf-8")) as ImportPreview)
      .filter((p) => p.status === "pending");
  }

  // ── Format detection ─────────────────────────────────────────────────────

  detectFormat(filePath: string): ImportFormat {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, ImportFormat> = {
      ".txt": "txt",
      ".md": "markdown",
      ".markdown": "markdown",
      ".docx": "docx",
      ".pdf": "pdf",
      ".epub": "epub",
      ".csv": "csv",
    };
    const format = map[ext];
    if (!format) throw new Error(`Unsupported file extension: ${ext}`);
    return format;
  }

  // ── Extraction ───────────────────────────────────────────────────────────

  async extract(filePath: string, format: ImportFormat): Promise<string> {
    switch (format) {
      case "txt":
      case "markdown":
        return fs.readFileSync(filePath, "utf-8");

      case "docx":
        return this.extractDocx(filePath);

      case "pdf":
        return this.extractPdf(filePath);

      case "epub":
        return this.extractEpub(filePath);

      case "csv":
        return this.extractCsv(filePath);

      default:
        throw new Error(`No extractor for format: ${format}`);
    }
  }

  private async extractDocx(filePath: string): Promise<string> {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  private async extractPdf(filePath: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfMod = await import("pdf-parse") as any;
    const pdfParse = pdfMod.default ?? pdfMod;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text as string;
  }

  private async extractEpub(filePath: string): Promise<string> {
    const unzipper = await import("unzipper");
    const parts: string[] = [];

    const directory = await unzipper.Open.file(filePath);
    const htmlFiles = directory.files
      .filter((f: { path: string }) => /\.(html|xhtml|htm)$/i.test(f.path))
      .sort((a: { path: string }, b: { path: string }) => a.path.localeCompare(b.path));

    for (const file of htmlFiles) {
      const content = (await file.buffer()).toString("utf-8");
      const text = content
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (text) parts.push(text);
    }

    return parts.join("\n\n");
  }

  private async extractCsv(filePath: string): Promise<string> {
    const { parse } = await import("csv-parse/sync");
    const raw = fs.readFileSync(filePath, "utf-8");
    const records = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    return records.map((row) => Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(" | ")).join("\n");
  }

  // ── Section detection ────────────────────────────────────────────────────

  private detectSections(text: string): ImportSection[] {
    const lines = text.split("\n");
    const sections: ImportSection[] = [];
    let currentHeading = "(preamble)";
    let buffer: string[] = [];

    const flush = () => {
      const content = buffer.join("\n").trim();
      if (content) {
        sections.push({
          heading: currentHeading,
          content,
          wordCount: content.split(/\s+/).filter(Boolean).length,
        });
      }
      buffer = [];
    };

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,3}\s+(.+)/) ?? line.match(/^([A-Z][A-Z\s]{4,})$/);
      if (headingMatch) {
        flush();
        currentHeading = headingMatch[1].trim();
      } else {
        buffer.push(line);
      }
    }
    flush();
    return sections;
  }

  // ── Commit to project ────────────────────────────────────────────────────

  private commitImport(projectRoot: string, preview: ImportPreview, citation?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const baseName = path.basename(preview.sourceFile, path.extname(preview.sourceFile));

    switch (preview.target) {
      case "research": {
        const researchDir = path.join(projectRoot, "research");
        fs.mkdirSync(researchDir, { recursive: true });
        const outPath = path.join(researchDir, `${baseName}-${timestamp}.md`);
        const header = [
          `# Imported: ${baseName}`,
          `Source: ${preview.sourceFile}`,
          `Type: ${preview.sourceType}`,
          citation ? `Citation: ${citation}` : null,
          `Imported: ${preview.createdAt}`,
          "",
        ].filter((l) => l !== null).join("\n");
        this.pathService.atomicWrite(outPath, header + preview.extractedText);

        this.memoryService.upsertResearchNote(projectRoot, {
          title: baseName,
          content: preview.extractedText.slice(0, 2000),
          sourceType: preview.sourceType,
          citation,
          relatedChapters: [],
          tags: [preview.format, preview.sourceType],
        });
        return outPath;
      }

      case "outline": {
        const outPath = path.join(projectRoot, "outline", `imported-${baseName}-${timestamp}.md`);
        this.pathService.atomicWrite(outPath, preview.extractedText);
        return outPath;
      }

      case "character-bible": {
        const outPath = path.join(projectRoot, "characters", `imported-${baseName}-${timestamp}.md`);
        this.pathService.atomicWrite(outPath, preview.extractedText);
        return outPath;
      }

      case "world-bible": {
        const outPath = path.join(projectRoot, "world", `imported-${baseName}-${timestamp}.md`);
        this.pathService.atomicWrite(outPath, preview.extractedText);
        return outPath;
      }

      case "timeline": {
        const outPath = path.join(projectRoot, "world", `timeline-${baseName}-${timestamp}.md`);
        this.pathService.atomicWrite(outPath, preview.extractedText);
        return outPath;
      }

      case "chapter-draft": {
        const outPath = path.join(projectRoot, "drafts", `imported-${baseName}-${timestamp}.md`);
        this.pathService.atomicWrite(outPath, preview.extractedText);
        return outPath;
      }

      default:
        throw new Error(`Unknown import target: ${preview.target}`);
    }
  }

  // ── Persistence helpers ──────────────────────────────────────────────────

  private loadPending(projectRoot: string, importId: string): ImportPreview {
    const filePath = path.join(projectRoot, PENDING_DIR, `${importId}.json`);
    if (!fs.existsSync(filePath)) throw new Error(`Import not found: ${importId}`);
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ImportPreview;
  }

  private savePending(projectRoot: string, preview: ImportPreview): void {
    const filePath = path.join(projectRoot, PENDING_DIR, `${preview.id}.json`);
    this.pathService.atomicWrite(filePath, JSON.stringify(preview, null, 2));
  }
}
