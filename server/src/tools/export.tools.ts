import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ExportService } from "../services/export.service.js";
import { AuditService } from "../services/audit.service.js";
import { ExportFormat } from "../types/export.js";

const EXPORT_FORMATS = ["markdown", "html", "docx", "epub", "pdf"] as const;

export function registerExportTools(
  server: McpServer,
  exportService: ExportService,
  audit: AuditService
): void {

  // ── Export readiness ──────────────────────────────────────────────────────

  server.tool(
    "check_export_readiness",
    "Check whether the manuscript is ready to export. Returns blockers (must fix), warnings (should review), word count, and chapter counts.",
    {
      projectRoot: z.string().min(1),
    },
    async ({ projectRoot }) => {
      try {
        const report = exportService.checkExportReadiness(projectRoot);
        audit.log({ type: "tool_call", tool: "check_export_readiness", outcome: report.ready ? "success" : "failure" });
        return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "check_export_readiness", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Build manuscript ──────────────────────────────────────────────────────

  server.tool(
    "build_manuscript",
    "Compile approved chapter drafts into manuscript order. Returns chapter list, total word count, and the full combined text. Use this to preview the manuscript before exporting.",
    {
      projectRoot: z.string().min(1),
      chapterNumbers: z.array(z.number().int().min(1)).optional().describe("Specific chapters to include. Omit to include all drafted chapters in order."),
      includeTitlePage: z.boolean().default(true),
      includeTableOfContents: z.boolean().default(false),
      dedication: z.string().optional(),
    },
    async ({ projectRoot, chapterNumbers, includeTitlePage, includeTableOfContents, dedication }) => {
      try {
        const result = exportService.buildManuscript(
          projectRoot,
          { titlePage: includeTitlePage, tableOfContents: includeTableOfContents, dedication },
          undefined,
          chapterNumbers
        );
        audit.log({ type: "tool_call", tool: "build_manuscript", outcome: "success", details: { chapterCount: result.chapters.length, totalWordCount: result.totalWordCount } });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              chapters: result.chapters,
              totalWordCount: result.totalWordCount,
              preview: result.fullText.slice(0, 2000) + (result.fullText.length > 2000 ? "\n\n[… truncated — use export_manuscript to get full text …]" : ""),
            }, null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "build_manuscript", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Export manuscript ─────────────────────────────────────────────────────

  server.tool(
    "export_manuscript",
    "Export the manuscript to a file. Supported formats: markdown (native), html (web preview), docx (editor-ready), epub (ebook), pdf (HTML source for browser print-to-PDF). Returns an export manifest with output path, word count, and source versions.",
    {
      projectRoot: z.string().min(1),
      format: z.enum(EXPORT_FORMATS),
      chapterNumbers: z.array(z.number().int().min(1)).optional(),
      includeTitlePage: z.boolean().default(true),
      includeTableOfContents: z.boolean().default(false),
      dedication: z.string().optional(),
      authorNote: z.string().optional(),
      aboutAuthor: z.string().optional(),
      glossary: z.record(z.string(), z.string()).optional().describe("Glossary terms and definitions for back matter"),
    },
    async ({ projectRoot, format, chapterNumbers, includeTitlePage, includeTableOfContents, dedication, authorNote, aboutAuthor, glossary }) => {
      try {
        const manifest = await exportService.exportManuscript(
          projectRoot,
          format as ExportFormat,
          { titlePage: includeTitlePage, tableOfContents: includeTableOfContents, dedication, authorNote },
          aboutAuthor || glossary ? { aboutAuthor, glossary } : undefined,
          chapterNumbers
        );
        audit.log({ type: "tool_call", tool: "export_manuscript", outcome: "success", details: { format, chapterCount: manifest.chapterCount, outputPath: manifest.outputPath } });
        return { content: [{ type: "text" as const, text: JSON.stringify(manifest, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "export_manuscript", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Generate export manifest ──────────────────────────────────────────────

  server.tool(
    "list_export_manifests",
    "List all export manifests for a project, newest first. Each manifest records format, output path, word count, chapter versions, and unresolved issues at time of export.",
    {
      projectRoot: z.string().min(1),
    },
    async ({ projectRoot }) => {
      try {
        const manifests = exportService.listExportManifests(projectRoot);
        audit.log({ type: "tool_call", tool: "list_export_manifests", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: manifests.length === 0
              ? "No exports found for this project."
              : JSON.stringify(manifests, null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "list_export_manifests", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );
}
