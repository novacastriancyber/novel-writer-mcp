import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ImportService } from "../services/import.service.js";
import { AuditService } from "../services/audit.service.js";

const IMPORT_TARGETS = ["research", "outline", "character-bible", "world-bible", "timeline", "chapter-draft"] as const;
const SOURCE_TYPES = ["fact", "invention"] as const;

export function registerImportTools(
  server: McpServer,
  importService: ImportService,
  audit: AuditService
): void {

  // ── preview_import ────────────────────────────────────────────────────────

  server.tool(
    "preview_import",
    "Extract and preview the content of a file before importing it into the project. Always call this before confirm_import. Supports TXT, Markdown, DOCX, PDF, EPUB, and CSV.",
    {
      projectRoot: z.string().min(1),
      sourceFile: z.string().min(1).describe("Absolute path to the file to import"),
      target: z.enum(IMPORT_TARGETS).describe("Where in the project the content will be stored"),
      sourceType: z.enum(SOURCE_TYPES).describe("fact = real-world research; invention = fictional element"),
    },
    async ({ projectRoot, sourceFile, target, sourceType }) => {
      try {
        const preview = await importService.preview(projectRoot, sourceFile, target, sourceType);
        audit.log({ type: "tool_call", tool: "preview_import", outcome: "success", details: { importId: preview.id, format: preview.format } });

        const summary = {
          importId: preview.id,
          format: preview.format,
          target: preview.target,
          sourceType: preview.sourceType,
          wordCount: preview.wordCount,
          detectedSections: preview.detectedSections.map((s) => ({
            heading: s.heading,
            wordCount: s.wordCount,
            preview: s.content.slice(0, 200) + (s.content.length > 200 ? "…" : ""),
          })),
          status: preview.status,
          instruction: `Review the sections above. Call confirm_import with importId "${preview.id}" to commit, or reject_import to discard.`,
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "preview_import", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── confirm_import ────────────────────────────────────────────────────────

  server.tool(
    "confirm_import",
    "Commit a previewed import to the project. Must call preview_import first and provide the importId returned.",
    {
      projectRoot: z.string().min(1),
      importId: z.string().min(1).describe("The importId returned by preview_import"),
      citation: z.string().optional().describe("Source citation for research imports (author, URL, publication, etc.)"),
    },
    async ({ projectRoot, importId, citation }) => {
      try {
        const record = importService.confirm(projectRoot, importId, citation);
        audit.log({ type: "tool_call", tool: "confirm_import", outcome: "success", details: { importId } });
        return { content: [{ type: "text" as const, text: JSON.stringify(record, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "confirm_import", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── reject_import ─────────────────────────────────────────────────────────

  server.tool(
    "reject_import",
    "Discard a previewed import. Nothing is written to the project.",
    {
      projectRoot: z.string().min(1),
      importId: z.string().min(1),
    },
    async ({ projectRoot, importId }) => {
      try {
        importService.reject(projectRoot, importId);
        audit.log({ type: "tool_call", tool: "reject_import", outcome: "success", details: { importId } });
        return { content: [{ type: "text" as const, text: `Import ${importId} rejected. No files written.` }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "reject_import", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── list_pending_imports ──────────────────────────────────────────────────

  server.tool(
    "list_pending_imports",
    "List all imports that have been previewed but not yet confirmed or rejected.",
    { projectRoot: z.string().min(1) },
    async ({ projectRoot }) => {
      try {
        const pending = importService.listPending(projectRoot);
        audit.log({ type: "tool_call", tool: "list_pending_imports", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: pending.length === 0
              ? "No pending imports."
              : JSON.stringify(pending.map((p) => ({
                  importId: p.id,
                  sourceFile: p.sourceFile,
                  format: p.format,
                  target: p.target,
                  wordCount: p.wordCount,
                  createdAt: p.createdAt,
                })), null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "list_pending_imports", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── index_research_note ───────────────────────────────────────────────────

  server.tool(
    "index_research_note",
    "Manually add a research note by pasting text directly — no file needed. Separates factual research from fictional invention.",
    {
      projectRoot: z.string().min(1),
      title: z.string().min(1),
      content: z.string().min(1),
      sourceType: z.enum(SOURCE_TYPES),
      citation: z.string().optional().describe("Source: author, URL, publication, date"),
      relatedChapters: z.array(z.number().int()).default([]),
      tags: z.array(z.string()).default([]),
    },
    async ({ projectRoot, title, content, sourceType, citation, relatedChapters, tags }) => {
      try {
        // Import service wraps memory service for this
        const { MemoryService } = await import("../services/memory.service.js");
        // We reach the memory service via the import service's internal reference.
        // For this standalone tool, reconstruct via the already-injected importService.
        // Actually call directly: save file + index in memory via preview+confirm flow is overkill here.
        // Write the note to research/ and index it.
        const { PathService } = await import("../services/path.service.js");
        const { AuditService: AuditSvc } = await import("../services/audit.service.js");

        const researchDir = `${projectRoot}/research`;
        const fs = await import("node:fs");
        fs.mkdirSync(researchDir, { recursive: true });

        const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const outPath = `${researchDir}/${safeTitle}-${timestamp}.md`;

        const header = [
          `# ${title}`,
          `Type: ${sourceType}`,
          citation ? `Citation: ${citation}` : null,
          tags.length ? `Tags: ${tags.join(", ")}` : null,
          "",
        ].filter((l) => l !== null).join("\n");

        // Use importService's pathService via closure — write directly
        const fileContent = header + "\n" + content;
        fs.writeFileSync(outPath + ".tmp", fileContent, "utf-8");
        fs.renameSync(outPath + ".tmp", outPath);

        audit.log({ type: "tool_call", tool: "index_research_note", outcome: "success", filePath: outPath });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ title, sourceType, savedTo: outPath, wordCount: content.split(/\s+/).filter(Boolean).length }, null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "index_research_note", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── list_research ─────────────────────────────────────────────────────────

  server.tool(
    "list_research",
    "List all research files in the project research folder with their names and sizes.",
    { projectRoot: z.string().min(1) },
    async ({ projectRoot }) => {
      try {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const researchDir = path.join(projectRoot, "research");
        const files = fs.existsSync(researchDir) ? fs.readdirSync(researchDir) : [];
        const entries = files
          .filter((f: string) => !f.endsWith(".tmp"))
          .map((f: string) => {
            const full = path.join(researchDir, f);
            const stat = fs.statSync(full);
            const firstLine = fs.readFileSync(full, "utf-8").split("\n")[0].replace(/^#+\s*/, "");
            return { file: f, title: firstLine, sizeKb: Math.round(stat.size / 102.4) / 10 };
          });
        audit.log({ type: "tool_call", tool: "list_research", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: entries.length === 0 ? "No research files yet." : JSON.stringify(entries, null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "list_research", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── get_research_note ─────────────────────────────────────────────────────

  server.tool(
    "get_research_note",
    "Read the full content of a research file by filename.",
    {
      projectRoot: z.string().min(1),
      filename: z.string().min(1).describe("Filename as returned by list_research"),
    },
    async ({ projectRoot, filename }) => {
      try {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const filePath = path.join(projectRoot, "research", filename);
        if (!fs.existsSync(filePath)) throw new Error(`Research file not found: ${filename}`);
        const content = fs.readFileSync(filePath, "utf-8");
        audit.log({ type: "tool_call", tool: "get_research_note", outcome: "success", filePath });
        return { content: [{ type: "text" as const, text: content }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "get_research_note", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );
}
