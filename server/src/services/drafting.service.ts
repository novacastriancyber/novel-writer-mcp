import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PathService } from "./path.service.js";
import { AuditService } from "./audit.service.js";
import { MemoryService } from "./memory.service.js";
import { PlanningService } from "./planning.service.js";
import {
  RevisionPass,
  RevisionPassType,
  ModelRoute,
  DraftContext,
  VersionComparison,
  WordCountProgress,
  ChapterWordCount,
  DraftSession,
} from "../types/drafting.js";
import { ProjectMetadata } from "../types/project.js";

const SESSION_FILE = "drafts/draft-session.json";

export class DraftingService {
  constructor(
    private pathService: PathService,
    private audit: AuditService,
    private memoryService: MemoryService,
    private planningService: PlanningService
  ) {}

  // ── Session ──────────────────────────────────────────────────────────────

  private loadSession(projectRoot: string): DraftSession {
    const filePath = path.join(projectRoot, SESSION_FILE);
    if (!fs.existsSync(filePath)) {
      return { projectId: path.basename(projectRoot), revisionPasses: [], updatedAt: new Date().toISOString() };
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as DraftSession;
  }

  private saveSession(projectRoot: string, session: DraftSession): void {
    session.updatedAt = new Date().toISOString();
    this.pathService.atomicWrite(path.join(projectRoot, SESSION_FILE), JSON.stringify(session, null, 2));
  }

  // ── Context assembly ─────────────────────────────────────────────────────

  assembleDraftContext(projectRoot: string, chapterNumber: number): DraftContext {
    const memory = this.memoryService.load(projectRoot);
    const plan = this.planningService.load(projectRoot);

    // Chapter brief
    const brief = plan.chapterBriefs.find((b) => b.chapterNumber === chapterNumber);
    const chapterBrief = brief
      ? [
          `Chapter ${brief.chapterNumber}: ${brief.title}`,
          `POV: ${brief.povCharacter}`,
          `Location: ${brief.location}`,
          `Dramatic question: ${brief.dramaticQuestion}`,
          `Goal: ${brief.goal}`,
          `Outcome: ${brief.outcome}`,
          brief.continuityItems.length ? `New continuity: ${brief.continuityItems.join("; ")}` : null,
        ].filter(Boolean).join("\n")
      : undefined;

    // Previous chapter summary (last approved version ending)
    let previousChapterSummary: string | undefined;
    if (chapterNumber > 1) {
      const prevVer = this.memoryService.getLatestChapterVersion(projectRoot, chapterNumber - 1);
      if (prevVer && fs.existsSync(prevVer.filePath)) {
        const prevText = fs.readFileSync(prevVer.filePath, "utf-8");
        const paragraphs = prevText.split(/\n\n+/).filter(Boolean);
        const lastThree = paragraphs.slice(-3).join("\n\n");
        previousChapterSummary = `[End of Chapter ${chapterNumber - 1}]\n${lastThree}`;
      }
    }

    // Active characters (non-archived only)
    const activeChars = Object.values(memory.characters)
      .filter((c) => c.status === "active")
      .map((c) =>
        [
          `${c.name} (${c.role})`,
          c.coreDesire ? `  Desire: ${c.coreDesire}` : null,
          c.arc ? `  Arc: ${c.arc}` : null,
          c.keyFacts.length ? `  Facts: ${c.keyFacts.slice(0, 3).join("; ")}` : null,
          c.doNotWrite.length ? `  Do not write: ${c.doNotWrite.join("; ")}` : null,
        ].filter(Boolean).join("\n")
      );
    const activeCharacters = activeChars.length ? activeChars.join("\n\n") : "(no characters defined yet)";

    // World notes summary
    const worldFiles = this.listWorldFiles(projectRoot);
    const worldNotes = worldFiles.length
      ? worldFiles.map((f) => {
          const text = fs.readFileSync(f, "utf-8");
          return text.slice(0, 800) + (text.length > 800 ? "\n[…truncated]" : "");
        }).join("\n\n---\n\n")
      : "(no world bible defined yet)";

    // Style guide summary
    const styleGuide = plan.styleGuide;
    const styleGuideSummary = styleGuide
      ? [
          `Tense: ${styleGuide.tenseNotes || "not specified"}`,
          `POV: ${styleGuide.povNotes || "not specified"}`,
          `Sentence rhythm: ${styleGuide.sentenceRhythm || "not specified"}`,
          `Dialogue: ${styleGuide.dialogueStyle || "not specified"}`,
          `Vocabulary: ${styleGuide.vocabularyLevel || "not specified"}`,
          styleGuide.doNotUseList.length ? `Do not use: ${styleGuide.doNotUseList.join(", ")}` : null,
        ].filter(Boolean).join("\n")
      : "(no style guide defined yet)";

    // Continuity obligations — facts established in prior chapters
    const priorFacts = this.memoryService.getContinuityByChapter(projectRoot, chapterNumber - 1);
    const continuityObligations = priorFacts.length
      ? priorFacts.slice(-20).map((f) => `[Ch.${f.establishedInChapter}/${f.category}] ${f.fact}`).join("\n")
      : "(no continuity facts recorded yet)";

    // Open plot threads
    const openThreads = this.memoryService.listOpenThreads(projectRoot);
    const openThreadsText = openThreads.length
      ? openThreads.map((t) => `• ${t.title} (${t.threadStatus}): ${t.description}`).join("\n")
      : "(no open threads)";

    // Research notes relevant to this chapter
    const allResearch = Object.values(memory.researchNotes)
      .filter((r) => r.status === "active" && (r.relatedChapters.includes(chapterNumber) || r.relatedChapters.length === 0))
      .slice(0, 5);
    const researchNotes = allResearch.length
      ? allResearch.map((r) => `[${r.sourceType.toUpperCase()}] ${r.title}: ${r.content.slice(0, 300)}`).join("\n\n")
      : "(no research notes)";

    this.audit.log({ type: "file_read", filePath: projectRoot, outcome: "success", details: { action: "assembleDraftContext", chapterNumber } });

    return {
      chapterNumber,
      chapterBrief,
      previousChapterSummary,
      activeCharacters,
      worldNotes: worldNotes.slice(0, 3000),
      styleGuideSummary,
      continuityObligations,
      openThreads: openThreadsText,
      researchNotes,
      assembledAt: new Date().toISOString(),
    };
  }

  private listWorldFiles(projectRoot: string): string[] {
    const worldDir = path.join(projectRoot, "world");
    if (!fs.existsSync(worldDir)) return [];
    return fs.readdirSync(worldDir)
      .filter((f) => f.endsWith(".md") || f.endsWith(".json"))
      .map((f) => path.join(worldDir, f));
  }

  // ── Draft save (delegates to memory service) ─────────────────────────────

  saveDraft(projectRoot: string, chapterNumber: number, content: string, notes?: string) {
    const version = this.memoryService.saveChapterVersion(projectRoot, chapterNumber, content, notes);
    this.audit.log({ type: "file_write", filePath: version.filePath, outcome: "success", details: { chapterNumber, version: version.version } });
    return version;
  }

  // ── Version comparison ───────────────────────────────────────────────────

  compareVersions(projectRoot: string, chapterNumber: number, versionA: number, versionB: number): VersionComparison {
    const memory = this.memoryService.load(projectRoot);
    const getVersion = (v: number) => memory.chapterVersions.find((cv) => cv.chapterNumber === chapterNumber && cv.version === v);

    const va = getVersion(versionA);
    const vb = getVersion(versionB);
    if (!va) throw new Error(`Chapter ${chapterNumber} v${versionA} not found`);
    if (!vb) throw new Error(`Chapter ${chapterNumber} v${versionB} not found`);

    const textA = fs.existsSync(va.filePath) ? fs.readFileSync(va.filePath, "utf-8") : "";
    const textB = fs.existsSync(vb.filePath) ? fs.readFileSync(vb.filePath, "utf-8") : "";

    const parasA = new Set(textA.split(/\n\n+/).map((p) => p.trim()).filter(Boolean));
    const parasB = new Set(textB.split(/\n\n+/).map((p) => p.trim()).filter(Boolean));

    const added = [...parasB].filter((p) => !parasA.has(p));
    const removed = [...parasA].filter((p) => !parasB.has(p));
    const common = [...parasB].filter((p) => parasA.has(p));

    const delta = vb.wordCount - va.wordCount;
    const significantChanges: string[] = [];

    if (Math.abs(delta) > 200) significantChanges.push(`Word count ${delta > 0 ? "increased" : "decreased"} by ${Math.abs(delta)} words`);
    if (added.length > 3) significantChanges.push(`${added.length} new paragraphs added`);
    if (removed.length > 3) significantChanges.push(`${removed.length} paragraphs removed`);
    if (added.length === 0 && removed.length === 0) significantChanges.push("No structural paragraph changes — likely copy-edit or polish");

    // Detect dialogue change
    const dialogueA = (textA.match(/"/g) ?? []).length;
    const dialogueB = (textB.match(/"/g) ?? []).length;
    if (Math.abs(dialogueA - dialogueB) > 10) {
      significantChanges.push(`Dialogue ${dialogueB > dialogueA ? "expanded" : "reduced"} (quote marks: ${dialogueA} → ${dialogueB})`);
    }

    const summary = [
      `v${versionA} (${va.wordCount} words) → v${versionB} (${vb.wordCount} words)`,
      `Delta: ${delta > 0 ? "+" : ""}${delta} words`,
      `Paragraphs: ${parasA.size} → ${parasB.size} (${added.length} added, ${removed.length} removed, ${common.length} unchanged)`,
    ].join(" | ");

    return {
      chapterNumber,
      versionA,
      versionB,
      wordCountA: va.wordCount,
      wordCountB: vb.wordCount,
      wordCountDelta: delta,
      addedParagraphs: added.length,
      removedParagraphs: removed.length,
      commonParagraphs: common.length,
      significantChanges,
      summary,
    };
  }

  // ── Word count progress ──────────────────────────────────────────────────

  getWordCountProgress(projectRoot: string, meta: ProjectMetadata): WordCountProgress {
    const memory = this.memoryService.load(projectRoot);
    const plan = this.planningService.load(projectRoot);
    const totalChapters = plan.structurePlan?.totalChapters ?? plan.chapterBriefs.length;

    // Latest version per chapter
    const latestPerChapter = new Map<number, { wordCount: number; approved: boolean }>();
    for (const cv of memory.chapterVersions) {
      const existing = latestPerChapter.get(cv.chapterNumber);
      if (!existing || cv.version > (memory.chapterVersions.find((c) => c.chapterNumber === cv.chapterNumber && c.version === existing.wordCount)?.version ?? 0)) {
        latestPerChapter.set(cv.chapterNumber, { wordCount: cv.wordCount, approved: cv.approved });
      }
    }

    // Build breakdown for all known chapters
    const allChapterNums = new Set([
      ...plan.chapterBriefs.map((b) => b.chapterNumber),
      ...latestPerChapter.keys(),
    ]);

    const chapterBreakdown: ChapterWordCount[] = [...allChapterNums]
      .sort((a, b) => a - b)
      .map((n) => {
        const data = latestPerChapter.get(n);
        return { chapterNumber: n, wordCount: data?.wordCount ?? 0, approved: data?.approved ?? false, hasContent: !!data };
      });

    const actualWordCount = chapterBreakdown.reduce((sum, c) => sum + c.wordCount, 0);
    const percentComplete = meta.settings.targetWordCount > 0
      ? Math.round((actualWordCount / meta.settings.targetWordCount) * 1000) / 10
      : 0;

    const chaptersWithContent = chapterBreakdown.filter((c) => c.hasContent);
    const averageWordsPerChapter = chaptersWithContent.length
      ? Math.round(actualWordCount / chaptersWithContent.length)
      : 0;

    const wordsRemaining = Math.max(0, meta.settings.targetWordCount - actualWordCount);
    const estimatedChaptersRemaining = averageWordsPerChapter > 0
      ? Math.ceil(wordsRemaining / averageWordsPerChapter)
      : totalChapters - chaptersWithContent.length;

    return {
      targetWordCount: meta.settings.targetWordCount,
      actualWordCount,
      percentComplete,
      chapterBreakdown,
      estimatedChaptersRemaining,
      averageWordsPerChapter,
    };
  }

  // ── Revision passes ──────────────────────────────────────────────────────

  saveRevisionPass(
    projectRoot: string,
    passType: RevisionPassType,
    instructions: string,
    scope: RevisionPass["scope"],
    inputVersion: number,
    modelRoute: ModelRoute,
    chapterNumber?: number,
    chapterRange?: [number, number]
  ): RevisionPass {
    const session = this.loadSession(projectRoot);
    const pass: RevisionPass = {
      id: `pass-${crypto.randomUUID().slice(0, 8)}`,
      passType,
      instructions,
      scope,
      chapterNumber,
      chapterRange,
      inputVersion,
      modelRoute,
      createdAt: new Date().toISOString(),
      approvalStatus: "pending",
    };
    session.revisionPasses.push(pass);
    this.saveSession(projectRoot, session);

    this.audit.log({ type: "tool_call", filePath: projectRoot, outcome: "success", details: { action: "saveRevisionPass", passId: pass.id, passType } });
    return pass;
  }

  completeRevisionPass(projectRoot: string, passId: string, outputVersion: number, changeSummary: string): RevisionPass {
    const session = this.loadSession(projectRoot);
    const pass = session.revisionPasses.find((p) => p.id === passId);
    if (!pass) throw new Error(`Revision pass not found: ${passId}`);
    pass.outputVersion = outputVersion;
    pass.changeSummary = changeSummary;
    pass.approvalStatus = "pending";
    this.saveSession(projectRoot, session);
    return pass;
  }

  approveRevisionPass(projectRoot: string, passId: string): RevisionPass {
    const session = this.loadSession(projectRoot);
    const pass = session.revisionPasses.find((p) => p.id === passId);
    if (!pass) throw new Error(`Revision pass not found: ${passId}`);
    pass.approvalStatus = "approved";
    this.saveSession(projectRoot, session);
    return pass;
  }

  listRevisionPasses(projectRoot: string, chapterNumber?: number): RevisionPass[] {
    const session = this.loadSession(projectRoot);
    return chapterNumber !== undefined
      ? session.revisionPasses.filter((p) => p.chapterNumber === chapterNumber || p.scope === "full-manuscript")
      : session.revisionPasses;
  }

  // ── Expansion / Condensation prompt builders ─────────────────────────────

  buildExpansionPrompt(passage: string, targetWords: number, context: string, instructions?: string): string {
    return [
      `You are a fiction editor expanding a passage.`,
      instructions ? `Author instructions: ${instructions}` : null,
      `Target length: approximately ${targetWords} words (current: ~${passage.split(/\s+/).filter(Boolean).length} words).`,
      ``,
      context ? `CONTEXT:\n${context}` : null,
      ``,
      `PASSAGE TO EXPAND:`,
      passage,
      ``,
      `Expand this passage by:`,
      `- Adding sensory detail (what the POV character sees, hears, smells, feels)`,
      `- Deepening interiority (thoughts, reactions, hesitations)`,
      `- Slowing the pacing at moments of emotional weight`,
      `- Do NOT add new plot events or characters not already present`,
      ``,
      `Return only the expanded passage — no preamble or explanation.`,
    ].filter((l) => l !== null).join("\n");
  }

  buildCondensationPrompt(passage: string, targetWords: number, context: string, instructions?: string): string {
    return [
      `You are a fiction editor condensing a passage.`,
      instructions ? `Author instructions: ${instructions}` : null,
      `Target length: approximately ${targetWords} words (current: ~${passage.split(/\s+/).filter(Boolean).length} words).`,
      ``,
      context ? `CONTEXT:\n${context}` : null,
      ``,
      `PASSAGE TO CONDENSE:`,
      passage,
      ``,
      `Condense this passage by:`,
      `- Removing redundant description`,
      `- Cutting repeated emotional beats`,
      `- Trimming dialogue tags and beats that don't add character information`,
      `- Preserving all plot events, character decisions, and continuity facts`,
      ``,
      `Return only the condensed passage — no preamble or explanation.`,
    ].filter((l) => l !== null).join("\n");
  }
}
