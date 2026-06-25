import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DraftingService } from "../services/drafting.service.js";
import { ProjectService } from "../services/project.service.js";
import { AuditService } from "../services/audit.service.js";

const REVISION_PASS_TYPES = [
  "developmental", "structure", "character-motivation", "dialogue", "pacing",
  "voice-consistency", "show-vs-tell", "genre-expectation", "continuity-repair",
  "copy-edit", "proofread", "export-cleanup",
] as const;

const SCOPE_TYPES = ["chapter", "range", "full-manuscript"] as const;
const MODEL_ROUTES = ["host", "llamacpp", "openrouter"] as const;

export function registerDraftingTools(
  server: McpServer,
  draftingService: DraftingService,
  projectService: ProjectService,
  audit: AuditService
): void {

  // ── Context assembly ──────────────────────────────────────────────────────

  server.tool(
    "assemble_draft_context",
    "Assemble all project context needed to draft a chapter: brief, characters, world notes, continuity obligations, open threads, style guide, and research. Call this before draft_chapter.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1),
    },
    async ({ projectRoot, chapterNumber }) => {
      try {
        const context = draftingService.assembleDraftContext(projectRoot, chapterNumber);
        audit.log({ type: "tool_call", tool: "assemble_draft_context", outcome: "success", details: { chapterNumber } });
        return { content: [{ type: "text" as const, text: JSON.stringify(context, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "assemble_draft_context", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Draft save ────────────────────────────────────────────────────────────

  server.tool(
    "save_draft",
    "Save a chapter draft. Automatically increments version number. Previous versions are preserved in the revisions folder.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1),
      content: z.string().min(1),
      notes: z.string().optional().describe("Optional notes about what changed in this version"),
    },
    async ({ projectRoot, chapterNumber, content, notes }) => {
      try {
        const version = draftingService.saveDraft(projectRoot, chapterNumber, content, notes);
        audit.log({ type: "tool_call", tool: "save_draft", outcome: "success", details: { chapterNumber, version: version.version } });
        return { content: [{ type: "text" as const, text: JSON.stringify(version, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "save_draft", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Version comparison ────────────────────────────────────────────────────

  server.tool(
    "compare_draft_versions",
    "Compare two versions of a chapter draft. Returns word count delta, paragraph changes, and a plain-English summary.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1),
      versionA: z.number().int().min(1),
      versionB: z.number().int().min(1),
    },
    async ({ projectRoot, chapterNumber, versionA, versionB }) => {
      try {
        const comparison = draftingService.compareVersions(projectRoot, chapterNumber, versionA, versionB);
        audit.log({ type: "tool_call", tool: "compare_draft_versions", outcome: "success", details: { chapterNumber, versionA, versionB } });
        return { content: [{ type: "text" as const, text: JSON.stringify(comparison, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "compare_draft_versions", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Word count progress ───────────────────────────────────────────────────

  server.tool(
    "get_word_count_progress",
    "Return word count progress across the whole manuscript — per chapter and total vs target.",
    { projectRoot: z.string().min(1) },
    async ({ projectRoot }) => {
      try {
        const meta = projectService.load(projectRoot);
        const progress = draftingService.getWordCountProgress(projectRoot, meta);
        audit.log({ type: "tool_call", tool: "get_word_count_progress", projectId: meta.id, outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(progress, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "get_word_count_progress", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Revision passes ───────────────────────────────────────────────────────

  server.tool(
    "start_revision_pass",
    "Record the start of a revision pass. Returns a passId to reference when completing the pass.",
    {
      projectRoot: z.string().min(1),
      passType: z.enum(REVISION_PASS_TYPES),
      instructions: z.string().min(1).describe("Author-specific instructions for this pass"),
      scope: z.enum(SCOPE_TYPES),
      chapterNumber: z.number().int().min(1).optional(),
      chapterRangeStart: z.number().int().min(1).optional(),
      chapterRangeEnd: z.number().int().min(1).optional(),
      inputVersion: z.number().int().min(1).describe("The chapter version this pass starts from"),
      modelRoute: z.enum(MODEL_ROUTES).default("host"),
    },
    async ({ projectRoot, passType, instructions, scope, chapterNumber, chapterRangeStart, chapterRangeEnd, inputVersion, modelRoute }) => {
      try {
        const chapterRange: [number, number] | undefined =
          chapterRangeStart && chapterRangeEnd ? [chapterRangeStart, chapterRangeEnd] : undefined;
        const pass = draftingService.saveRevisionPass(
          projectRoot, passType, instructions, scope, inputVersion, modelRoute, chapterNumber, chapterRange
        );
        audit.log({ type: "tool_call", tool: "start_revision_pass", outcome: "success", details: { passId: pass.id, passType } });
        return { content: [{ type: "text" as const, text: JSON.stringify(pass, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "start_revision_pass", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "complete_revision_pass",
    "Record the completion of a revision pass — link it to the output version and record a change summary.",
    {
      projectRoot: z.string().min(1),
      passId: z.string().min(1),
      outputVersion: z.number().int().min(1),
      changeSummary: z.string().min(1),
    },
    async ({ projectRoot, passId, outputVersion, changeSummary }) => {
      try {
        const pass = draftingService.completeRevisionPass(projectRoot, passId, outputVersion, changeSummary);
        audit.log({ type: "tool_call", tool: "complete_revision_pass", outcome: "success", details: { passId } });
        return { content: [{ type: "text" as const, text: JSON.stringify(pass, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "complete_revision_pass", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "approve_revision_pass",
    "Mark a completed revision pass as author-approved.",
    {
      projectRoot: z.string().min(1),
      passId: z.string().min(1),
    },
    async ({ projectRoot, passId }) => {
      try {
        const pass = draftingService.approveRevisionPass(projectRoot, passId);
        audit.log({ type: "tool_call", tool: "approve_revision_pass", outcome: "success", details: { passId } });
        return { content: [{ type: "text" as const, text: `Pass ${passId} (${pass.passType}) approved.` }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "approve_revision_pass", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_revision_passes",
    "List all revision passes for a project, optionally filtered to a specific chapter.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1).optional(),
    },
    async ({ projectRoot, chapterNumber }) => {
      try {
        const passes = draftingService.listRevisionPasses(projectRoot, chapterNumber);
        audit.log({ type: "tool_call", tool: "list_revision_passes", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: passes.length === 0 ? "No revision passes recorded." : JSON.stringify(passes, null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "list_revision_passes", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Expansion / Condensation ──────────────────────────────────────────────

  server.tool(
    "expand_passage",
    "Build a prompt to expand a short passage to a target word count. Returns the prompt for the host model to execute.",
    {
      projectRoot: z.string().min(1),
      passage: z.string().min(1),
      targetWords: z.number().int().min(50),
      chapterNumber: z.number().int().min(1).optional().describe("Used to pull relevant context"),
      instructions: z.string().optional(),
    },
    async ({ projectRoot, passage, targetWords, chapterNumber, instructions }) => {
      try {
        let context = "";
        if (chapterNumber) {
          const ctx = draftingService.assembleDraftContext(projectRoot, chapterNumber);
          context = [
            ctx.styleGuideSummary,
            ctx.activeCharacters.slice(0, 500),
          ].join("\n\n");
        }
        const prompt = draftingService.buildExpansionPrompt(passage, targetWords, context, instructions);
        audit.log({ type: "tool_call", tool: "expand_passage", outcome: "success" });
        return { content: [{ type: "text" as const, text: prompt }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "expand_passage", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "condense_passage",
    "Build a prompt to condense a passage to a target word count. Returns the prompt for the host model to execute.",
    {
      projectRoot: z.string().min(1),
      passage: z.string().min(1),
      targetWords: z.number().int().min(20),
      chapterNumber: z.number().int().min(1).optional(),
      instructions: z.string().optional(),
    },
    async ({ projectRoot, passage, targetWords, chapterNumber, instructions }) => {
      try {
        let context = "";
        if (chapterNumber) {
          const ctx = draftingService.assembleDraftContext(projectRoot, chapterNumber);
          context = ctx.styleGuideSummary;
        }
        const prompt = draftingService.buildCondensationPrompt(passage, targetWords, context, instructions);
        audit.log({ type: "tool_call", tool: "condense_passage", outcome: "success" });
        return { content: [{ type: "text" as const, text: prompt }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "condense_passage", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Read chapter draft ────────────────────────────────────────────────────

  server.tool(
    "get_chapter_draft",
    "Read the latest (or a specific) version of a chapter draft.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1),
      version: z.number().int().min(1).optional().describe("Omit to get the latest version"),
    },
    async ({ projectRoot, chapterNumber, version }) => {
      try {
        const memory = (await import("../services/memory.service.js")).MemoryService;
        const fs = await import("node:fs");
        const path = await import("node:path");

        const memData = JSON.parse(
          fs.readFileSync(path.join(projectRoot, "memory/memory.json"), "utf-8")
        ) as import("../types/memory.js").ProjectMemory;

        const versions = memData.chapterVersions.filter((v) => v.chapterNumber === chapterNumber);
        if (versions.length === 0) {
          return { content: [{ type: "text" as const, text: `No drafts found for chapter ${chapterNumber}.` }] };
        }

        const target = version
          ? versions.find((v) => v.version === version)
          : versions.at(-1);

        if (!target) throw new Error(`Chapter ${chapterNumber} v${version} not found`);
        if (!fs.existsSync(target.filePath)) throw new Error(`Draft file missing: ${target.filePath}`);

        const content = fs.readFileSync(target.filePath, "utf-8");
        audit.log({ type: "tool_call", tool: "get_chapter_draft", outcome: "success", details: { chapterNumber, version: target.version } });
        return { content: [{ type: "text" as const, text: content }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "get_chapter_draft", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── List chapter drafts ───────────────────────────────────────────────────

  server.tool(
    "list_chapter_drafts",
    "List all saved draft versions for a chapter with word counts and approval status.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1),
    },
    async ({ projectRoot, chapterNumber }) => {
      try {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const memData = JSON.parse(
          fs.readFileSync(path.join(projectRoot, "memory/memory.json"), "utf-8")
        ) as import("../types/memory.js").ProjectMemory;

        const versions = memData.chapterVersions
          .filter((v) => v.chapterNumber === chapterNumber)
          .map((v) => ({ version: v.version, wordCount: v.wordCount, approved: v.approved, createdAt: v.createdAt, notes: v.notes }));

        audit.log({ type: "tool_call", tool: "list_chapter_drafts", outcome: "success", details: { chapterNumber } });
        return {
          content: [{
            type: "text" as const,
            text: versions.length === 0
              ? `No drafts for chapter ${chapterNumber}.`
              : JSON.stringify(versions, null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "list_chapter_drafts", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );
}
