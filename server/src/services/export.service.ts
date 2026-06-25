import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PathService } from "./path.service.js";
import { AuditService } from "./audit.service.js";
import { MemoryService } from "./memory.service.js";
import { PlanningService } from "./planning.service.js";
import { ProjectService } from "./project.service.js";
import {
  ExportFormat,
  ExportManifest,
  ExportedChapter,
  ExportReadinessReport,
  ExportStatus,
  FrontMatter,
  BackMatter,
} from "../types/export.js";
import { ProjectMetadata } from "../types/project.js";

export class ExportService {
  constructor(
    private pathService: PathService,
    private audit: AuditService,
    private memoryService: MemoryService,
    private planningService: PlanningService,
    private projectService: ProjectService
  ) {}

  // ── Export readiness ─────────────────────────────────────────────────────

  checkExportReadiness(projectRoot: string): ExportReadinessReport {
    const meta = this.projectService.load(projectRoot);
    const memory = this.memoryService.load(projectRoot);
    const plan = this.planningService.load(projectRoot);

    const blockers: string[] = [];
    const warnings: string[] = [];

    // Must have at least one chapter
    const chapters = memory.chapterVersions;
    if (chapters.length === 0) {
      blockers.push("No chapter drafts found. Write at least one chapter before exporting.");
    }

    // Count latest version per chapter
    const latestPerChapter = this.getLatestPerChapter(memory.chapterVersions);
    const totalWords = [...latestPerChapter.values()].reduce((sum, cv) => sum + cv.wordCount, 0);
    const approvedCount = [...latestPerChapter.values()].filter((cv) => cv.approved).length;

    if (latestPerChapter.size > 0 && approvedCount === 0) {
      warnings.push("No chapters have been author-approved. Consider approving chapters before export.");
    }

    // Check for open plot threads that should be resolved
    const openThreads = this.memoryService.listOpenThreads(projectRoot);
    if (openThreads.length > 0) {
      warnings.push(`${openThreads.length} open plot thread(s) unresolved: ${openThreads.map((t) => t.title).join(", ")}.`);
    }

    // Check word count vs target
    if (meta.settings.targetWordCount > 0 && totalWords < meta.settings.targetWordCount * 0.8) {
      warnings.push(`Manuscript is at ${totalWords} words, which is under 80% of the target (${meta.settings.targetWordCount} words).`);
    }

    // No style guide
    if (!plan.styleGuide) {
      warnings.push("No style guide defined for this project.");
    }

    const ready = blockers.length === 0;

    const report: ExportReadinessReport = {
      projectRoot,
      checkedAt: new Date().toISOString(),
      ready,
      blockers,
      warnings,
      totalWordCount: totalWords,
      draftedChapters: latestPerChapter.size,
      approvedChapters: approvedCount,
      summary: ready
        ? `Ready to export. ${latestPerChapter.size} chapter(s), ${totalWords} words.${warnings.length > 0 ? ` ${warnings.length} warning(s).` : ""}`
        : `Not ready to export. ${blockers.length} blocker(s) must be resolved first.`,
    };

    this.audit.log({ type: "tool_call", filePath: projectRoot, outcome: ready ? "success" : "failure", details: { action: "checkExportReadiness" } });
    return report;
  }

  // ── Manuscript builder ───────────────────────────────────────────────────

  buildManuscript(
    projectRoot: string,
    frontMatter?: FrontMatter,
    backMatter?: BackMatter,
    chapterNumbers?: number[]
  ): { chapters: ExportedChapter[]; fullText: string; totalWordCount: number } {
    const memory = this.memoryService.load(projectRoot);
    const plan = this.planningService.load(projectRoot);
    const latestPerChapter = this.getLatestPerChapter(memory.chapterVersions);

    const selectedNums = chapterNumbers ?? [...latestPerChapter.keys()].sort((a, b) => a - b);

    const parts: string[] = [];
    const exportedChapters: ExportedChapter[] = [];

    // Front matter
    if (frontMatter) {
      const meta = this.projectService.load(projectRoot);
      if (frontMatter.titlePage) {
        parts.push(`# ${meta.settings.workingTitle}\n\n*${meta.settings.genres.map((g) => g.genre).join(" / ")}*\n`);
      }
      if (frontMatter.tableOfContents) {
        const tocLines = selectedNums.map((n) => {
          const brief = plan.chapterBriefs.find((b) => b.chapterNumber === n);
          return `- Chapter ${n}${brief ? `: ${brief.title}` : ""}`;
        });
        parts.push(`## Contents\n\n${tocLines.join("\n")}\n`);
      }
      if (frontMatter.dedication) parts.push(`---\n\n*${frontMatter.dedication}*\n\n---\n`);
      if (frontMatter.acknowledgements) parts.push(`## Acknowledgements\n\n${frontMatter.acknowledgements}\n`);
      if (frontMatter.authorNote) parts.push(`## Author's Note\n\n${frontMatter.authorNote}\n`);
    }

    for (const chNum of selectedNums) {
      const cv = latestPerChapter.get(chNum);
      if (!cv) continue;
      if (!fs.existsSync(cv.filePath)) continue;

      const text = fs.readFileSync(cv.filePath, "utf-8");
      const brief = plan.chapterBriefs.find((b) => b.chapterNumber === chNum);
      const chapterHeading = brief ? `# Chapter ${chNum}: ${brief.title}` : `# Chapter ${chNum}`;

      parts.push(`${chapterHeading}\n\n${text.trim()}`);

      exportedChapters.push({
        chapterNumber: chNum,
        title: brief?.title ?? `Chapter ${chNum}`,
        wordCount: cv.wordCount,
        version: cv.version,
        approved: cv.approved,
      });
    }

    // Back matter
    if (backMatter) {
      if (backMatter.aboutAuthor) parts.push(`## About the Author\n\n${backMatter.aboutAuthor}\n`);
      if (backMatter.acknowledgements) parts.push(`## Acknowledgements\n\n${backMatter.acknowledgements}\n`);
      if (backMatter.glossary && Object.keys(backMatter.glossary).length > 0) {
        const glossLines = Object.entries(backMatter.glossary)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([term, def]) => `**${term}**: ${def}`);
        parts.push(`## Glossary\n\n${glossLines.join("\n\n")}\n`);
      }
    }

    const fullText = parts.join("\n\n---\n\n");
    const totalWordCount = exportedChapters.reduce((sum, c) => sum + c.wordCount, 0);

    return { chapters: exportedChapters, fullText, totalWordCount };
  }

  // ── Export drivers ───────────────────────────────────────────────────────

  async exportManuscript(
    projectRoot: string,
    format: ExportFormat,
    frontMatter?: FrontMatter,
    backMatter?: BackMatter,
    chapterNumbers?: number[]
  ): Promise<ExportManifest> {
    const meta = this.projectService.load(projectRoot);
    const { chapters, fullText, totalWordCount } = this.buildManuscript(projectRoot, frontMatter, backMatter, chapterNumbers);

    const unresolvedIssues = this.gatherUnresolvedIssues(projectRoot);
    const exportsDir = path.join(projectRoot, "exports");
    fs.mkdirSync(exportsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const slug = meta.settings.workingTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

    let outputPath: string;
    let status: ExportStatus = "complete";
    let notes: string | undefined;

    switch (format) {
      case "markdown":
        outputPath = path.join(exportsDir, `${slug}-${timestamp}.md`);
        this.pathService.atomicWrite(outputPath, fullText);
        break;

      case "html":
        outputPath = path.join(exportsDir, `${slug}-${timestamp}.html`);
        this.pathService.atomicWrite(outputPath, this.buildHtml(fullText, meta));
        break;

      case "docx":
        outputPath = path.join(exportsDir, `${slug}-${timestamp}.docx`);
        await this.buildDocx(fullText, meta, outputPath, frontMatter);
        break;

      case "epub":
        outputPath = path.join(exportsDir, `${slug}-${timestamp}.epub`);
        await this.buildEpub(projectRoot, chapters, meta, outputPath, frontMatter, backMatter);
        break;

      case "pdf":
        // Generate HTML and note that PDF printing requires a browser or pandoc
        outputPath = path.join(exportsDir, `${slug}-${timestamp}-pdf-source.html`);
        this.pathService.atomicWrite(outputPath, this.buildHtml(fullText, meta, true));
        status = "partial";
        notes = "PDF source HTML generated. Open in a browser and print to PDF, or run: pandoc \"" + outputPath + "\" -o output.pdf";
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    const manifest = this.saveManifest(projectRoot, {
      id: `export-${crypto.randomUUID().slice(0, 8)}`,
      projectId: meta.id,
      projectTitle: meta.settings.workingTitle,
      format,
      exportedAt: new Date().toISOString(),
      outputPath,
      totalWordCount,
      chapterCount: chapters.length,
      chapters,
      unresolvedIssues,
      status,
      notes,
    });

    this.audit.log({
      type: "file_write",
      filePath: outputPath,
      outcome: "success",
      details: { format, chapterCount: chapters.length, totalWordCount },
    });

    return manifest;
  }

  // ── Markdown (identity) ──────────────────────────────────────────────────
  // (already handled by buildManuscript returning fullText directly)

  // ── HTML ─────────────────────────────────────────────────────────────────

  private buildHtml(markdownText: string, meta: ProjectMetadata, printFriendly = false): string {
    const title = meta.settings.workingTitle;
    // Convert basic Markdown to HTML (headings, bold, italic, paragraphs)
    const body = markdownText
      .replace(/^#{1}\s+(.+)$/gm, "<h1>$1</h1>")
      .replace(/^#{2}\s+(.+)$/gm, "<h2>$1</h2>")
      .replace(/^#{3}\s+(.+)$/gm, "<h3>$1</h3>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^---$/gm, "<hr>")
      .split(/\n\n+/)
      .map((block) => {
        const trimmed = block.trim();
        if (trimmed.startsWith("<h") || trimmed.startsWith("<hr")) return trimmed;
        return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
      })
      .join("\n");

    const printStyle = printFriendly
      ? `@media print { body { font-size: 12pt; } h1 { page-break-before: always; } }`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${this.escHtml(title)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 720px; margin: 2rem auto; line-height: 1.8; color: #222; padding: 0 1rem; }
  h1 { font-size: 1.8rem; margin-top: 3rem; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem; }
  h2 { font-size: 1.4rem; margin-top: 2rem; }
  h3 { font-size: 1.1rem; }
  p { margin: 1rem 0; text-indent: 1.5em; }
  p:first-of-type { text-indent: 0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 2rem 0; }
  ${printStyle}
</style>
</head>
<body>
${body}
</body>
</html>`;
  }

  private escHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ── DOCX ─────────────────────────────────────────────────────────────────

  private async buildDocx(fullText: string, meta: ProjectMetadata, outputPath: string, frontMatter?: FrontMatter): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docxMod: any = await import("docx");
    const {
      Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
    } = docxMod;

    const children: InstanceType<typeof Paragraph>[] = [];

    if (frontMatter?.titlePage) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: meta.settings.workingTitle, bold: true, size: 48 })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: meta.settings.genres.map((g) => g.genre).join(" / "), size: 28, italics: true })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ children: [new PageBreak()] })
      );
    }

    for (const line of fullText.split("\n")) {
      const h1 = line.match(/^#\s+(.+)/);
      const h2 = line.match(/^##\s+(.+)/);
      const h3 = line.match(/^###\s+(.+)/);
      const hr = line.trim() === "---";

      if (h1) {
        children.push(new Paragraph({ text: h1[1], heading: HeadingLevel.HEADING_1 }));
      } else if (h2) {
        children.push(new Paragraph({ text: h2[1], heading: HeadingLevel.HEADING_2 }));
      } else if (h3) {
        children.push(new Paragraph({ text: h3[1], heading: HeadingLevel.HEADING_3 }));
      } else if (hr) {
        children.push(new Paragraph({ text: "" }));
      } else if (line.trim()) {
        // Handle inline bold/italic
        const runs = this.parseInlineRuns(line.trim(), TextRun);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children.push(new Paragraph({ children: runs as any }));
      } else {
        children.push(new Paragraph({ text: "" }));
      }
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseInlineRuns(text: string, TextRun: any): unknown[] {
    const runs: unknown[] = [];
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    for (const part of parts) {
      if (part.startsWith("**") && part.endsWith("**")) {
        runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
      } else if (part.startsWith("*") && part.endsWith("*")) {
        runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
      } else if (part) {
        runs.push(new TextRun({ text: part }));
      }
    }
    return runs;
  }

  // ── EPUB ─────────────────────────────────────────────────────────────────

  private async buildEpub(
    projectRoot: string,
    chapters: ExportedChapter[],
    meta: ProjectMetadata,
    outputPath: string,
    frontMatter?: FrontMatter,
    backMatter?: BackMatter
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const archiverMod: any = await import("archiver");
    // archiver v8: use ZipArchive directly
    const ZipArchive = archiverMod.ZipArchive ?? archiverMod.default?.ZipArchive;
    if (!ZipArchive) throw new Error("archiver ZipArchive not found — archiver v8+ required");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const output = fs.createWriteStream(outputPath);

    await new Promise<void>((resolve, reject) => {
      const archive = new ZipArchive({ store: true });
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);

      const title = meta.settings.workingTitle;
      const uid = `urn:uuid:${crypto.randomUUID()}`;
      const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");

      // mimetype (MUST be first, uncompressed)
      archive.append("application/epub+zip", { name: "mimetype", store: true });

      // META-INF/container.xml
      archive.append(
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
        { name: "META-INF/container.xml" }
      );

      // Chapter HTML files
      const chapterItems = chapters.map((c) => ({
        id: `chapter-${c.chapterNumber}`,
        href: `chapter-${c.chapterNumber}.xhtml`,
        title: c.title,
      }));

      for (const ch of chapters) {
        const cv = this.memoryService.load(projectRoot)
          .chapterVersions.find((v) => v.chapterNumber === ch.chapterNumber && v.version === ch.version);
        const text = cv && fs.existsSync(cv.filePath) ? fs.readFileSync(cv.filePath, "utf-8") : "";
        const htmlBody = text.split(/\n\n+/).map((p) => `<p>${this.escHtml(p.trim())}</p>`).join("\n");

        archive.append(
          `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter ${ch.chapterNumber}: ${this.escHtml(ch.title)}</title></head>
<body>
<h1>Chapter ${ch.chapterNumber}: ${this.escHtml(ch.title)}</h1>
${htmlBody}
</body>
</html>`,
          { name: `OEBPS/chapter-${ch.chapterNumber}.xhtml` }
        );
      }

      // content.opf
      const manifestItems = chapterItems
        .map((c) => `    <item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`)
        .join("\n");
      const spineItems = chapterItems
        .map((c) => `    <itemref idref="${c.id}"/>`)
        .join("\n");
      const tocItems = chapterItems
        .map((c, i) => `  <navPoint id="nav-${i + 1}" playOrder="${i + 1}">
    <navLabel><text>Chapter ${c.title}</text></navLabel>
    <content src="${c.href}"/>
  </navPoint>`)
        .join("\n");

      archive.append(
        `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${this.escHtml(title)}</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">${uid}</dc:identifier>
    <dc:date>${now}</dc:date>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`,
        { name: "OEBPS/content.opf" }
      );

      // toc.ncx
      archive.append(
        `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${this.escHtml(title)}</text></docTitle>
  <navMap>
${tocItems}
  </navMap>
</ncx>`,
        { name: "OEBPS/toc.ncx" }
      );

      archive.finalize();
    });
  }

  // ── Manifest ─────────────────────────────────────────────────────────────

  private saveManifest(projectRoot: string, manifest: ExportManifest): ExportManifest {
    const exportsDir = path.join(projectRoot, "exports");
    fs.mkdirSync(exportsDir, { recursive: true });
    const manifestPath = path.join(exportsDir, `${manifest.id}-manifest.json`);
    this.pathService.atomicWrite(manifestPath, JSON.stringify(manifest, null, 2));
    return manifest;
  }

  listExportManifests(projectRoot: string): ExportManifest[] {
    const exportsDir = path.join(projectRoot, "exports");
    if (!fs.existsSync(exportsDir)) return [];
    return fs.readdirSync(exportsDir)
      .filter((f) => f.endsWith("-manifest.json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(exportsDir, f), "utf-8")) as ExportManifest)
      .sort((a, b) => b.exportedAt.localeCompare(a.exportedAt));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getLatestPerChapter(versions: { chapterNumber: number; version: number; wordCount: number; approved: boolean; filePath: string }[]) {
    const map = new Map<number, { version: number; wordCount: number; approved: boolean; filePath: string }>();
    for (const cv of versions) {
      const existing = map.get(cv.chapterNumber);
      if (!existing || cv.version > existing.version) {
        map.set(cv.chapterNumber, { version: cv.version, wordCount: cv.wordCount, approved: cv.approved, filePath: cv.filePath });
      }
    }
    return map;
  }

  private gatherUnresolvedIssues(projectRoot: string): string[] {
    const issues: string[] = [];
    const threads = this.memoryService.listOpenThreads(projectRoot);
    if (threads.length > 0) {
      issues.push(`${threads.length} open plot thread(s): ${threads.map((t) => t.title).join(", ")}`);
    }
    return issues;
  }
}
