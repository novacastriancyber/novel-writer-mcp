import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlanningService } from "../services/planning.service.js";
import { AuditService } from "../services/audit.service.js";
import { StructureModel } from "../types/planning.js";

const STRUCTURE_MODELS = ["three-act", "hero-journey", "save-the-cat", "five-act", "fichtean-curve", "story-circle", "custom"] as const;

export function registerPlanningTools(
  server: McpServer,
  planningService: PlanningService,
  audit: AuditService
): void {

  // ── Premise ───────────────────────────────────────────────────────────────

  server.tool(
    "save_premise",
    "Save the approved premise, logline, and source idea for the novel. Overwrites previous version (old version archived).",
    {
      projectRoot: z.string().min(1),
      ideaSource: z.string().min(1).describe("The original one-line or paragraph idea"),
      premise: z.string().min(1).describe("2–3 sentence premise: character, desire, obstacle, stakes"),
      logline: z.string().min(1).describe("Single sentence of 25–40 words"),
    },
    async ({ projectRoot, ideaSource, premise, logline }) => {
      try {
        const saved = planningService.savePremise(projectRoot, ideaSource, premise, logline);
        audit.log({ type: "tool_call", tool: "save_premise", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(saved, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "save_premise", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_premise",
    "Retrieve the current approved premise and logline for a project.",
    { projectRoot: z.string().min(1) },
    async ({ projectRoot }) => {
      try {
        const premise = planningService.getPremise(projectRoot);
        audit.log({ type: "tool_call", tool: "get_premise", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: premise ? JSON.stringify(premise, null, 2) : "No premise saved yet.",
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "get_premise", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Synopsis ──────────────────────────────────────────────────────────────

  server.tool(
    "save_synopsis",
    "Save a short (150–250 word) or full synopsis. Both can coexist. Previous version is archived.",
    {
      projectRoot: z.string().min(1),
      length: z.enum(["short", "full"]),
      content: z.string().min(1),
    },
    async ({ projectRoot, length, content }) => {
      try {
        const saved = planningService.saveSynopsis(projectRoot, length, content);
        audit.log({ type: "tool_call", tool: "save_synopsis", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(saved, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "save_synopsis", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_synopsis",
    "Retrieve the current short or full synopsis.",
    {
      projectRoot: z.string().min(1),
      length: z.enum(["short", "full"]),
    },
    async ({ projectRoot, length }) => {
      try {
        const synopsis = planningService.getSynopsis(projectRoot, length);
        audit.log({ type: "tool_call", tool: "get_synopsis", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: synopsis ? synopsis.content : `No ${length} synopsis saved yet.`,
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "get_synopsis", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Genre Contract ────────────────────────────────────────────────────────

  server.tool(
    "save_genre_contract",
    "Save the genre contract — the promises this novel must keep for readers of its genre(s).",
    {
      projectRoot: z.string().min(1),
      genres: z.array(z.string().min(1)).min(1),
      promises: z.array(z.object({
        promise: z.string().min(1),
        mandatory: z.boolean().default(true),
        notes: z.string().optional(),
      })).min(1),
      readerExpectations: z.array(z.string()).default([]),
      tropeGuidance: z.array(z.string()).default([]),
    },
    async ({ projectRoot, genres, promises, readerExpectations, tropeGuidance }) => {
      try {
        const saved = planningService.saveGenreContract(projectRoot, genres, promises, readerExpectations, tropeGuidance);
        audit.log({ type: "tool_call", tool: "save_genre_contract", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(saved, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "save_genre_contract", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Style Guide ───────────────────────────────────────────────────────────

  server.tool(
    "save_style_guide",
    "Save the project style guide — voice, rhythm, dialogue style, POV and tense notes, vocabulary level, and do-not-use list.",
    {
      projectRoot: z.string().min(1),
      profiles: z.array(z.object({
        name: z.string().min(1),
        traits: z.array(z.string()),
        sourceNotes: z.string().default(""),
      })).default([]),
      sentenceRhythm: z.string().default(""),
      paragraphLength: z.string().default(""),
      dialogueStyle: z.string().default(""),
      descriptionDensity: z.string().default(""),
      povNotes: z.string().default(""),
      tenseNotes: z.string().default(""),
      vocabularyLevel: z.string().default(""),
      doNotUseList: z.array(z.string()).default([]),
    },
    async ({ projectRoot, ...input }) => {
      try {
        const saved = planningService.saveStyleGuide(projectRoot, input as import("../types/planning.js").StyleGuide);
        audit.log({ type: "tool_call", tool: "save_style_guide", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(saved, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "save_style_guide", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Structure Plan ────────────────────────────────────────────────────────

  server.tool(
    "get_structure_template",
    "Return the built-in act structure and turning points for a given structure model. Use this to understand the template before saving a plan.",
    {
      model: z.enum(STRUCTURE_MODELS),
    },
    async ({ model }) => {
      try {
        const acts = planningService.getStructureTemplate(model as StructureModel);
        audit.log({ type: "tool_call", tool: "get_structure_template", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify({ model, acts }, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "get_structure_template", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "save_structure_plan",
    "Save the novel's structure plan — acts, chapter ranges, and turning points.",
    {
      projectRoot: z.string().min(1),
      model: z.enum(STRUCTURE_MODELS),
      totalChapters: z.number().int().min(1).max(200),
      customName: z.string().optional(),
      acts: z.array(z.object({
        number: z.number().int().min(1),
        name: z.string().min(1),
        purpose: z.string().min(1),
        chapterRange: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
        keyTurningPoint: z.string().min(1),
      })).min(1),
    },
    async ({ projectRoot, model, totalChapters, customName, acts }) => {
      try {
        const saved = planningService.saveStructurePlan(projectRoot, model as StructureModel, acts, totalChapters, customName);
        audit.log({ type: "tool_call", tool: "save_structure_plan", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(saved, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "save_structure_plan", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Chapter Briefs ────────────────────────────────────────────────────────

  server.tool(
    "save_chapter_brief",
    "Save or update a chapter brief — the approved plan for a single chapter before drafting begins.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1),
      title: z.string().min(1),
      povCharacter: z.string().min(1),
      location: z.string().min(1),
      dramaticQuestion: z.string().min(1).describe("The question this chapter answers"),
      goal: z.string().min(1).describe("What the POV character is trying to achieve"),
      outcome: z.string().min(1).describe("How the chapter ends — goal met, failed, or complicated"),
      continuityItems: z.array(z.string()).default([]).describe("New facts, objects, or relationships this chapter introduces"),
      sceneCount: z.number().int().min(1).default(3),
    },
    async ({ projectRoot, ...brief }) => {
      try {
        const saved = planningService.saveChapterBrief(projectRoot, brief);
        audit.log({ type: "tool_call", tool: "save_chapter_brief", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(saved, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "save_chapter_brief", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_chapter_brief",
    "Retrieve the approved brief for a specific chapter.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1),
    },
    async ({ projectRoot, chapterNumber }) => {
      try {
        const brief = planningService.getChapterBrief(projectRoot, chapterNumber);
        audit.log({ type: "tool_call", tool: "get_chapter_brief", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: brief ? JSON.stringify(brief, null, 2) : `No brief saved for chapter ${chapterNumber}.`,
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "get_chapter_brief", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_chapter_briefs",
    "List all chapter briefs for a project in chapter order.",
    { projectRoot: z.string().min(1) },
    async ({ projectRoot }) => {
      try {
        const briefs = planningService.listChapterBriefs(projectRoot);
        audit.log({ type: "tool_call", tool: "list_chapter_briefs", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: briefs.length === 0
              ? "No chapter briefs yet."
              : JSON.stringify(briefs.map((b) => ({
                  chapterNumber: b.chapterNumber,
                  title: b.title,
                  povCharacter: b.povCharacter,
                  outcome: b.outcome,
                  version: b.version,
                })), null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "list_chapter_briefs", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Scene Briefs ──────────────────────────────────────────────────────────

  server.tool(
    "save_scene_brief",
    "Save or update a scene brief — the approved plan for a single scene within a chapter.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1),
      sceneNumber: z.number().int().min(1),
      title: z.string().min(1),
      povCharacter: z.string().min(1),
      location: z.string().min(1),
      goal: z.string().min(1),
      conflict: z.string().min(1),
      outcome: z.string().min(1),
      hook: z.string().default("").describe("Opening hook for the scene"),
      endHook: z.string().default("").describe("Final beat that pulls into the next scene"),
      wordCountTarget: z.number().int().min(100).default(800),
    },
    async ({ projectRoot, ...brief }) => {
      try {
        const saved = planningService.saveSceneBrief(projectRoot, brief);
        audit.log({ type: "tool_call", tool: "save_scene_brief", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(saved, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "save_scene_brief", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_scenes_for_chapter",
    "List all scene briefs for a specific chapter in scene order.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1),
    },
    async ({ projectRoot, chapterNumber }) => {
      try {
        const scenes = planningService.listScenesForChapter(projectRoot, chapterNumber);
        audit.log({ type: "tool_call", tool: "list_scenes_for_chapter", outcome: "success" });
        return {
          content: [{
            type: "text" as const,
            text: scenes.length === 0
              ? `No scene briefs for chapter ${chapterNumber}.`
              : JSON.stringify(scenes, null, 2),
          }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "list_scenes_for_chapter", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Draft Readiness ───────────────────────────────────────────────────────

  server.tool(
    "check_draft_readiness",
    "Check whether the project has all required planning documents before drafting can begin. Returns missing items and warnings.",
    { projectRoot: z.string().min(1) },
    async ({ projectRoot }) => {
      try {
        const result = planningService.checkDraftReadiness(projectRoot);
        audit.log({ type: "tool_call", tool: "check_draft_readiness", outcome: "success" });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "check_draft_readiness", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );
}
