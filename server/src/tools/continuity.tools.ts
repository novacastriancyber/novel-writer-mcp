import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ContinuityService } from "../services/continuity.service.js";
import { AuditService } from "../services/audit.service.js";

export function registerContinuityTools(
  server: McpServer,
  continuityService: ContinuityService,
  audit: AuditService
): void {

  // ── Continuity check ──────────────────────────────────────────────────────

  server.tool(
    "check_continuity",
    "Run full continuity analysis: character name consistency, plot thread integrity, duplicate facts, and missing chapter drafts. Returns a report classifying each issue as blocking, warning, or note.",
    {
      projectRoot: z.string().min(1),
      upToChapter: z.number().int().min(1).optional().describe("Only check continuity up to and including this chapter number"),
    },
    async ({ projectRoot, upToChapter }) => {
      try {
        const report = continuityService.checkContinuity(projectRoot, upToChapter);
        audit.log({ type: "tool_call", tool: "check_continuity", outcome: report.passed ? "success" : "failure", details: { blocking: report.blockingCount } });
        return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "check_continuity", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Chapter readiness check ───────────────────────────────────────────────

  server.tool(
    "check_chapter_readiness",
    "Check whether the next chapter is safe to draft. Runs a continuity check on all prior chapters, verifies a brief exists for the target chapter, and checks for a style guide. Blocking issues prevent drafting unless an author override is applied.",
    {
      projectRoot: z.string().min(1),
      targetChapter: z.number().int().min(1).describe("The chapter number you want to draft next"),
      overrideApproved: z.boolean().default(false).describe("Set true if the author has approved proceeding despite blocking issues"),
    },
    async ({ projectRoot, targetChapter, overrideApproved }) => {
      try {
        const report = continuityService.checkChapterReadiness(projectRoot, targetChapter, overrideApproved);
        audit.log({ type: "tool_call", tool: "check_chapter_readiness", outcome: report.ready ? "success" : "failure", details: { targetChapter, ready: report.ready } });
        return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "check_chapter_readiness", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Style consistency check ───────────────────────────────────────────────

  server.tool(
    "check_style_consistency",
    "Check a chapter draft against the project style guide: do-not-use words, tense consistency, and POV consistency. Requires a saved draft and a style guide.",
    {
      projectRoot: z.string().min(1),
      chapterNumber: z.number().int().min(1),
    },
    async ({ projectRoot, chapterNumber }) => {
      try {
        const report = continuityService.checkStyleConsistency(projectRoot, chapterNumber);
        audit.log({ type: "tool_call", tool: "check_style_consistency", outcome: "success", details: { chapterNumber, issueCount: report.issues.length } });
        return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "check_style_consistency", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Genre contract check ──────────────────────────────────────────────────

  server.tool(
    "check_genre_contract",
    "Check whether the draft manuscript satisfies genre expectations defined in the genre contract. Runs heuristics for known genres and validates must-include requirements.",
    {
      projectRoot: z.string().min(1),
    },
    async ({ projectRoot }) => {
      try {
        const report = continuityService.checkGenreContract(projectRoot);
        audit.log({ type: "tool_call", tool: "check_genre_contract", outcome: "success", details: { issueCount: report.issues.length } });
        return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "check_genre_contract", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ── Pacing check ──────────────────────────────────────────────────────────

  server.tool(
    "check_pacing",
    "Analyse pacing across all drafted chapters. Returns per-chapter word count, dialogue ratio, paragraph length, and a pacing label (fast/moderate/slow), plus overall notes on outlier chapters.",
    {
      projectRoot: z.string().min(1),
    },
    async ({ projectRoot }) => {
      try {
        const report = continuityService.checkPacing(projectRoot);
        audit.log({ type: "tool_call", tool: "check_pacing", outcome: "success", details: { chapterCount: report.chapters.length } });
        return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "check_pacing", outcome: "failure", errorMessage: String(err) });
        return { content: [{ type: "text" as const, text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );
}
