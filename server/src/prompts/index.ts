import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AuditService } from "../services/audit.service.js";

export function registerPrompts(server: McpServer, audit: AuditService): void {

  // ── develop_premise ────────────────────────────────────────────────────────
  server.prompt(
    "develop_premise",
    "Develop a novel premise from a one-line idea into a full premise, logline, and short synopsis",
    {
      idea: z.string().min(1).describe("One-line or paragraph idea for the novel"),
      genre: z.string().min(1).describe("Primary genre"),
      targetWordCount: z.number().int().min(1000).optional().describe("Target manuscript word count"),
    },
    async ({ idea, genre, targetWordCount }) => {
      audit.log({ type: "prompt_get", resource: "develop_premise", outcome: "success" });
      const lengthNote = targetWordCount ? ` The manuscript targets approximately ${targetWordCount.toLocaleString()} words.` : "";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `You are a novel development assistant. The author has provided the following idea:`,
                ``,
                `IDEA: ${idea}`,
                `GENRE: ${genre}${lengthNote}`,
                ``,
                `Please develop this into:`,
                `1. PREMISE — A 2–3 sentence statement of character, desire, obstacle, and stakes.`,
                `2. LOGLINE — A single sentence of 25–40 words capturing the core story.`,
                `3. SHORT SYNOPSIS — 150–250 words covering the beginning, middle, and end at a high level.`,
                `4. GENRE CONTRACT — Three to five promises this story must keep for readers of this genre.`,
                ``,
                `Present each section with a clear heading. Do not begin writing the novel itself.`,
              ].join("\n"),
            },
          },
        ],
      };
    }
  );

  // ── generate_outline ───────────────────────────────────────────────────────
  server.prompt(
    "generate_outline",
    "Generate a chapter-level outline from an approved premise and synopsis",
    {
      premise: z.string().min(1),
      synopsis: z.string().min(1),
      structureModel: z.string().default("three-act").describe("three-act, hero-journey, save-the-cat, or custom"),
      chapterCount: z.number().int().min(1).max(200).optional(),
    },
    async ({ premise, synopsis, structureModel, chapterCount }) => {
      audit.log({ type: "prompt_get", resource: "generate_outline", outcome: "success" });
      const chapNote = chapterCount ? ` Target approximately ${chapterCount} chapters.` : "";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `You are a novel structure assistant. Using the premise and synopsis below, produce a chapter-level outline.`,
                ``,
                `PREMISE: ${premise}`,
                `SYNOPSIS: ${synopsis}`,
                `STRUCTURE MODEL: ${structureModel}${chapNote}`,
                ``,
                `For each chapter provide:`,
                `- Chapter number and working title`,
                `- Point-of-view character`,
                `- Primary scene location`,
                `- Core dramatic question answered`,
                `- Chapter goal and outcome`,
                `- Key continuity items introduced (characters, objects, facts, clues)`,
                ``,
                `Format as a numbered list. Do not write prose chapters.`,
              ].join("\n"),
            },
          },
        ],
      };
    }
  );

  // ── draft_chapter ──────────────────────────────────────────────────────────
  server.prompt(
    "draft_chapter",
    "Draft a chapter from an approved chapter brief and loaded project context",
    {
      chapterBrief: z.string().min(1),
      characterSummaries: z.string().optional().describe("Relevant character notes"),
      worldNotes: z.string().optional().describe("Relevant world/setting notes"),
      continuityObligations: z.string().optional().describe("Active continuity obligations to honour"),
      styleGuide: z.string().optional().describe("Style guide summary for this project"),
      researchNotes: z.string().optional().describe("Relevant research citations"),
    },
    async ({ chapterBrief, characterSummaries, worldNotes, continuityObligations, styleGuide, researchNotes }) => {
      audit.log({ type: "prompt_get", resource: "draft_chapter", outcome: "success" });
      const sections = [
        `CHAPTER BRIEF:\n${chapterBrief}`,
        characterSummaries ? `CHARACTERS:\n${characterSummaries}` : null,
        worldNotes ? `WORLD NOTES:\n${worldNotes}` : null,
        continuityObligations ? `CONTINUITY OBLIGATIONS:\n${continuityObligations}` : null,
        styleGuide ? `STYLE GUIDE:\n${styleGuide}` : null,
        researchNotes ? `RESEARCH:\n${researchNotes}` : null,
      ].filter(Boolean).join("\n\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `You are a novel drafting assistant. Draft this chapter based on the approved brief and context below.`,
                ``,
                sections,
                ``,
                `Requirements:`,
                `- Follow the style guide precisely`,
                `- Honour all continuity obligations listed`,
                `- End the chapter with a list of new continuity items introduced`,
                `- Do not introduce characters, places, or objects not in the brief unless essential`,
              ].join("\n"),
            },
          },
        ],
      };
    }
  );

  // ── continuity_check ───────────────────────────────────────────────────────
  server.prompt(
    "continuity_check",
    "Check a chapter draft for continuity issues against the project memory",
    {
      chapterText: z.string().min(1),
      characterFacts: z.string().optional(),
      worldFacts: z.string().optional(),
      timelineFacts: z.string().optional(),
      openThreads: z.string().optional(),
    },
    async ({ chapterText, characterFacts, worldFacts, timelineFacts, openThreads }) => {
      audit.log({ type: "prompt_get", resource: "continuity_check", outcome: "success" });
      const context = [
        characterFacts ? `CHARACTER FACTS:\n${characterFacts}` : null,
        worldFacts ? `WORLD FACTS:\n${worldFacts}` : null,
        timelineFacts ? `TIMELINE:\n${timelineFacts}` : null,
        openThreads ? `OPEN PLOT THREADS:\n${openThreads}` : null,
      ].filter(Boolean).join("\n\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `You are a continuity checker. Review the chapter draft below against the established project facts.`,
                ``,
                context,
                ``,
                `CHAPTER DRAFT:\n${chapterText}`,
                ``,
                `Report:`,
                `1. BLOCKING ISSUES — contradictions that must be fixed before this chapter can be approved`,
                `2. WARNINGS — inconsistencies or risks that should be reviewed`,
                `3. NEW FACTS INTRODUCED — new continuity items this chapter establishes`,
                `4. OPEN THREADS ADVANCED — which open threads this chapter progresses or resolves`,
                ``,
                `If no issues: state "No blocking issues found."`,
              ].join("\n"),
            },
          },
        ],
      };
    }
  );

  // ── revision_pass ──────────────────────────────────────────────────────────
  server.prompt(
    "revision_pass",
    "Run a specific revision pass on a chapter or section",
    {
      text: z.string().min(1),
      passType: z.enum([
        "developmental",
        "structure",
        "character-motivation",
        "dialogue",
        "pacing",
        "voice-consistency",
        "show-vs-tell",
        "genre-expectation",
        "continuity-repair",
        "copy-edit",
        "proofread",
        "export-cleanup",
      ]),
      instructions: z.string().optional().describe("Author-specific instructions for this pass"),
    },
    async ({ text, passType, instructions }) => {
      audit.log({ type: "prompt_get", resource: "revision_pass", outcome: "success" });
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `You are a fiction editor performing a ${passType.replace(/-/g, " ")} revision pass.`,
                instructions ? `Author instructions: ${instructions}` : null,
                ``,
                `TEXT TO REVISE:\n${text}`,
                ``,
                `Return the revised text followed by a short change summary listing what was altered and why.`,
              ].filter(Boolean).join("\n"),
            },
          },
        ],
      };
    }
  );
}
