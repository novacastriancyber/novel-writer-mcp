import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MemoryService } from "../services/memory.service.js";
import { AuditService } from "../services/audit.service.js";
import { ProjectService } from "../services/project.service.js";

const characterSchema = {
  projectRoot: z.string().min(1),
  id: z.string().optional().describe("Provide to update an existing character"),
  name: z.string().min(1),
  role: z.enum(["protagonist", "antagonist", "supporting", "minor"]),
  aliases: z.array(z.string()).default([]),
  age: z.number().int().optional(),
  occupation: z.string().optional(),
  affiliation: z.string().optional(),
  physicalDescription: z.string().default(""),
  voice: z.string().default(""),
  coreDesire: z.string().default(""),
  coreWound: z.string().optional(),
  flaw: z.string().optional(),
  arc: z.string().optional(),
  relationships: z.record(z.string(), z.string()).default({}),
  keyFacts: z.array(z.string()).default([]),
  doNotWrite: z.array(z.string()).default([]),
};

const locationSchema = {
  projectRoot: z.string().min(1),
  id: z.string().optional(),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  description: z.string().default(""),
  atmosphere: z.string().default(""),
  significance: z.string().default(""),
  firstAppearance: z.string().optional(),
  keyFacts: z.array(z.string()).default([]),
};

export function registerMemoryTools(
  server: McpServer,
  memoryService: MemoryService,
  projectService: ProjectService,
  audit: AuditService
): void {

  // ── Characters ───────────────────────────────────────────────────────────

  server.tool(
    "upsert_character",
    "Add a new character or update an existing one in the project memory. Provide id to update.",
    characterSchema,
    async ({ projectRoot, ...input }) => {
      try {
        const meta = projectService.load(projectRoot);
        const char = memoryService.upsertCharacter(projectRoot, input);
        audit.log({ type: "tool_call", tool: "upsert_character", projectId: meta.id, outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(char, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "upsert_character", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "archive_character",
    "Archive a character from the project memory. Archived characters are preserved but excluded from active context.",
    { projectRoot: z.string().min(1), characterId: z.string().min(1) },
    async ({ projectRoot, characterId }) => {
      try {
        memoryService.archiveCharacter(projectRoot, characterId);
        audit.log({ type: "tool_call", tool: "archive_character", outcome: "success" });
        return { content: [{ type: "text" as const, text: `Character ${characterId} archived.` }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "archive_character", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Locations ────────────────────────────────────────────────────────────

  server.tool(
    "upsert_location",
    "Add a new location or update an existing one in the project memory.",
    locationSchema,
    async ({ projectRoot, ...input }) => {
      try {
        const loc = memoryService.upsertLocation(projectRoot, input);
        audit.log({ type: "tool_call", tool: "upsert_location", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(loc, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "upsert_location", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "archive_location",
    "Archive a location from the project memory.",
    { projectRoot: z.string().min(1), locationId: z.string().min(1) },
    async ({ projectRoot, locationId }) => {
      try {
        memoryService.archiveLocation(projectRoot, locationId);
        audit.log({ type: "tool_call", tool: "archive_location", outcome: "success" });
        return { content: [{ type: "text" as const, text: `Location ${locationId} archived.` }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "archive_location", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Plot Threads ─────────────────────────────────────────────────────────

  server.tool(
    "upsert_plot_thread",
    "Add or update a plot thread. Use threadStatus to track open/advanced/resolved/abandoned.",
    {
      projectRoot: z.string().min(1),
      id: z.string().optional(),
      title: z.string().min(1),
      description: z.string().default(""),
      threadStatus: z.enum(["open", "advanced", "resolved", "abandoned"]).default("open"),
      openedInChapter: z.number().int().optional(),
      resolvedInChapter: z.number().int().optional(),
      obligatedBy: z.array(z.string()).default([]),
      relatedCharacters: z.array(z.string()).default([]),
      relatedLocations: z.array(z.string()).default([]),
      notes: z.string().default(""),
    },
    async ({ projectRoot, ...input }) => {
      try {
        const thread = memoryService.upsertThread(projectRoot, input);
        audit.log({ type: "tool_call", tool: "upsert_plot_thread", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(thread, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "upsert_plot_thread", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_open_threads",
    "List all open or advanced plot threads in the project — those that must be resolved before the manuscript is complete.",
    { projectRoot: z.string().min(1) },
    async ({ projectRoot }) => {
      try {
        const threads = memoryService.listOpenThreads(projectRoot);
        audit.log({ type: "tool_call", tool: "list_open_threads", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: threads.length === 0
              ? "No open plot threads."
              : JSON.stringify(threads, null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "list_open_threads", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Research Notes ───────────────────────────────────────────────────────

  server.tool(
    "upsert_research_note",
    "Add or update a research note. Use sourceType 'fact' for real-world research and 'invention' for fictional elements.",
    {
      projectRoot: z.string().min(1),
      id: z.string().optional(),
      title: z.string().min(1),
      content: z.string().min(1),
      sourceType: z.enum(["fact", "invention"]),
      citation: z.string().optional(),
      relatedChapters: z.array(z.number().int()).default([]),
      tags: z.array(z.string()).default([]),
    },
    async ({ projectRoot, ...input }) => {
      try {
        const note = memoryService.upsertResearchNote(projectRoot, input);
        audit.log({ type: "tool_call", tool: "upsert_research_note", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(note, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "upsert_research_note", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Continuity ───────────────────────────────────────────────────────────

  server.tool(
    "add_continuity_fact",
    "Record a continuity fact established in a chapter. Used to build the continuity baseline and check future chapters.",
    {
      projectRoot: z.string().min(1),
      fact: z.string().min(1),
      establishedInChapter: z.number().int().min(0),
      category: z.enum(["character", "world", "timeline", "object", "clue", "relationship"]),
      relatedEntityIds: z.array(z.string()).default([]),
    },
    async ({ projectRoot, ...input }) => {
      try {
        const record = memoryService.addContinuityFact(projectRoot, input);
        audit.log({ type: "tool_call", tool: "add_continuity_fact", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(record, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "add_continuity_fact", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_continuity_for_chapter",
    "Retrieve all continuity facts established up to and including a given chapter number.",
    {
      projectRoot: z.string().min(1),
      upToChapter: z.number().int().min(0),
    },
    async ({ projectRoot, upToChapter }) => {
      try {
        const facts = memoryService.getContinuityByChapter(projectRoot, upToChapter);
        audit.log({ type: "tool_call", tool: "get_continuity_for_chapter", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: facts.length === 0
              ? "No continuity facts recorded yet."
              : JSON.stringify(facts, null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "get_continuity_for_chapter", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Versioning ───────────────────────────────────────────────────────────

  server.tool(
    "save_chapter_version",
    "Save a new version of a chapter draft. Automatically increments version number and stores in revisions folder.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1),
      content: z.string().min(1),
      notes: z.string().optional(),
    },
    async ({ projectRoot, chapterNumber, content, notes }) => {
      try {
        const meta = projectService.load(projectRoot);
        const version = memoryService.saveChapterVersion(projectRoot, chapterNumber, content, notes);
        meta.currentDraftVersion = Math.max(meta.currentDraftVersion, version.version);
        meta.wordCountActual = Object.values(
          memoryService.load(projectRoot).chapterVersions
            .reduce((acc, v) => {
              if (!acc[v.chapterNumber] || v.version > acc[v.chapterNumber].version) {
                acc[v.chapterNumber] = v;
              }
              return acc;
            }, {} as Record<number, import("../types/memory.js").ChapterVersion>)
        ).reduce((sum, v) => sum + v.wordCount, 0);
        projectService.save(meta);
        audit.log({ type: "tool_call", tool: "save_chapter_version", projectId: meta.id, outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(version, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "save_chapter_version", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "approve_chapter_version",
    "Mark a chapter version as author-approved.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1),
      version: z.number().int().min(1),
    },
    async ({ projectRoot, chapterNumber, version }) => {
      try {
        memoryService.approveChapterVersion(projectRoot, chapterNumber, version);
        audit.log({ type: "tool_call", tool: "approve_chapter_version", outcome: "success" });
        return { content: [{ type: "text" as const, text: `Chapter ${chapterNumber} v${version} approved.` }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "approve_chapter_version", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "save_outline_version",
    "Save a new version of the project outline.",
    {
      projectRoot: z.string().min(1),
      content: z.string().min(1),
      notes: z.string().optional(),
    },
    async ({ projectRoot, content, notes }) => {
      try {
        const version = memoryService.saveOutlineVersion(projectRoot, content, notes);
        audit.log({ type: "tool_call", tool: "save_outline_version", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(version, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "save_outline_version", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_project_memory_summary",
    "Return a summary of all active memory records in a project — characters, locations, threads, continuity facts, and version counts.",
    { projectRoot: z.string().min(1) },
    async ({ projectRoot }) => {
      try {
        const memory = memoryService.load(projectRoot);
        const summary = {
          characters: {
            active: Object.values(memory.characters).filter((c) => c.status === "active").length,
            archived: Object.values(memory.characters).filter((c) => c.status === "archived").length,
          },
          locations: {
            active: Object.values(memory.locations).filter((l) => l.status === "active").length,
            archived: Object.values(memory.locations).filter((l) => l.status === "archived").length,
          },
          plotThreads: {
            open: Object.values(memory.plotThreads).filter((t) => t.threadStatus === "open").length,
            advanced: Object.values(memory.plotThreads).filter((t) => t.threadStatus === "advanced").length,
            resolved: Object.values(memory.plotThreads).filter((t) => t.threadStatus === "resolved").length,
          },
          researchNotes: Object.values(memory.researchNotes).length,
          continuityFacts: memory.continuityRecords.length,
          chapterVersions: memory.chapterVersions.length,
          outlineVersions: memory.outlineVersions.length,
          updatedAt: memory.updatedAt,
        };
        audit.log({ type: "tool_call", tool: "get_project_memory_summary", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "get_project_memory_summary", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_archived_records",
    "List all archived memory records for a project.",
    { projectRoot: z.string().min(1) },
    async ({ projectRoot }) => {
      try {
        const files = memoryService.listArchivedRecords(projectRoot);
        audit.log({ type: "tool_call", tool: "list_archived_records", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: files.length === 0 ? "No archived records." : files.join("\n"),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "list_archived_records", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );
}
