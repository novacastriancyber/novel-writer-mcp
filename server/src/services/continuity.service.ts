import fs from "node:fs";
import path from "node:path";
import { PathService } from "./path.service.js";
import { AuditService } from "./audit.service.js";
import { MemoryService } from "./memory.service.js";
import { PlanningService } from "./planning.service.js";
import {
  ContinuityIssue,
  ContinuityReport,
  ReadinessReport,
  StyleConsistencyReport,
  StyleIssue,
  GenreContractReport,
  GenreContractIssue,
  PacingReport,
  ChapterPacingInfo,
} from "../types/continuity.js";

export class ContinuityService {
  constructor(
    private pathService: PathService,
    private audit: AuditService,
    private memoryService: MemoryService,
    private planningService: PlanningService
  ) {}

  // ── Continuity checker ───────────────────────────────────────────────────

  checkContinuity(projectRoot: string, upToChapter?: number): ContinuityReport {
    const memory = this.memoryService.load(projectRoot);
    const issues: ContinuityIssue[] = [];

    // 1. Character name consistency — duplicate names across records
    const names = new Map<string, string[]>();
    for (const char of Object.values(memory.characters)) {
      const key = char.name.toLowerCase();
      const existing = names.get(key) ?? [];
      existing.push(char.id);
      names.set(key, existing);
    }
    for (const [name, ids] of names) {
      if (ids.length > 1) {
        issues.push({
          severity: "warning",
          category: "character-name",
          description: `Duplicate character name "${name}" found in ${ids.length} records (IDs: ${ids.join(", ")}).`,
          suggestion: "Archive or merge duplicate character records.",
        });
      }
    }

    // 2. Character alias conflicts — alias matches another character's primary name
    const primaryNames = new Set(Object.values(memory.characters).map((c) => c.name.toLowerCase()));
    for (const char of Object.values(memory.characters)) {
      for (const alias of char.aliases ?? []) {
        if (primaryNames.has(alias.toLowerCase()) && alias.toLowerCase() !== char.name.toLowerCase()) {
          issues.push({
            severity: "note",
            category: "character-alias",
            description: `"${char.name}" has alias "${alias}" that matches another character's primary name.`,
            characterName: char.name,
            suggestion: "Verify alias is intentional to avoid reader confusion.",
          });
        }
      }
    }

    // 3. Open plot threads without an establishing chapter
    for (const thread of Object.values(memory.plotThreads)) {
      if (thread.threadStatus === "open" && !thread.openedInChapter) {
        issues.push({
          severity: "note",
          category: "plot-thread",
          description: `Plot thread "${thread.title}" is open but has no established chapter.`,
          suggestion: "Set openedInChapter to track when this thread was introduced.",
        });
      }
    }

    // 4. Continuity facts — check for duplicate fact statements within same chapter
    const factKeys = new Set<string>();
    for (const fact of memory.continuityRecords ?? []) {
      if (upToChapter && fact.establishedInChapter > upToChapter) continue;
      const key = `${fact.establishedInChapter}:${fact.fact.trim().toLowerCase()}`;
      if (factKeys.has(key)) {
        issues.push({
          severity: "note",
          category: "continuity-fact",
          description: `Duplicate continuity fact in chapter ${fact.establishedInChapter}: "${fact.fact.slice(0, 80)}"`,
          chapterNumber: fact.establishedInChapter,
          suggestion: "Remove duplicate fact to keep the continuity index clean.",
        });
      }
      factKeys.add(key);
    }

    // 5. Archived characters referenced in open threads
    const archivedIds = new Set(
      Object.values(memory.characters).filter((c) => c.status === "archived").map((c) => c.id)
    );
    for (const thread of Object.values(memory.plotThreads)) {
      if (thread.threadStatus === "open") {
        for (const charId of thread.relatedCharacters ?? []) {
          if (archivedIds.has(charId)) {
            issues.push({
              severity: "warning",
              category: "archived-character-in-thread",
              description: `Open plot thread "${thread.title}" references archived character ID "${charId}".`,
              suggestion: "Close the thread or restore the character.",
            });
          }
        }
      }
    }

    // 6. Chapter versions — chapters with no draft beyond what briefs expect
    const plan = this.planningService.load(projectRoot);
    const draftedChapters = new Set(memory.chapterVersions.map((cv) => cv.chapterNumber));
    if (plan.chapterBriefs.length > 0 && upToChapter !== undefined) {
      for (let i = 1; i < upToChapter; i++) {
        if (!draftedChapters.has(i)) {
          issues.push({
            severity: "blocking",
            category: "missing-draft",
            description: `Chapter ${i} has a brief but no draft. Cannot verify continuity across an unwritten chapter.`,
            chapterNumber: i,
            suggestion: `Draft chapter ${i} before drafting chapter ${upToChapter}.`,
          });
        }
      }
    }

    const blocking = issues.filter((i) => i.severity === "blocking").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;
    const notes = issues.filter((i) => i.severity === "note").length;
    const passed = blocking === 0;

    const report: ContinuityReport = {
      projectRoot,
      checkedAt: new Date().toISOString(),
      chapterScope: upToChapter,
      issues,
      blockingCount: blocking,
      warningCount: warnings,
      noteCount: notes,
      passed,
      summary: passed
        ? `Continuity check passed. ${warnings} warning(s), ${notes} note(s).`
        : `Continuity check FAILED. ${blocking} blocking issue(s), ${warnings} warning(s), ${notes} note(s). Resolve blocking issues before proceeding.`,
    };

    this.audit.log({
      type: "tool_call",
      filePath: projectRoot,
      outcome: passed ? "success" : "failure",
      details: { action: "checkContinuity", blocking, warnings, notes },
    });

    // Save report
    this.saveReport(projectRoot, "continuity", report);
    return report;
  }

  // ── Chapter readiness checker ────────────────────────────────────────────

  checkChapterReadiness(projectRoot: string, targetChapter: number, overrideApproved = false): ReadinessReport {
    const continuity = this.checkContinuity(projectRoot, targetChapter - 1);
    const plan = this.planningService.load(projectRoot);
    const issues = [...continuity.issues];

    // Must have a chapter brief to draft
    const hasBrief = plan.chapterBriefs.some((b) => b.chapterNumber === targetChapter);
    if (!hasBrief) {
      issues.push({
        severity: "blocking",
        category: "missing-brief",
        description: `No chapter brief found for chapter ${targetChapter}.`,
        chapterNumber: targetChapter,
        suggestion: `Use save_chapter_brief to create a brief for chapter ${targetChapter} first.`,
      });
    }

    // Style guide recommended (warning only)
    if (!plan.styleGuide) {
      issues.push({
        severity: "warning",
        category: "missing-style-guide",
        description: "No style guide defined for this project.",
        suggestion: "Use save_style_guide to define voice, tense, and POV before drafting.",
      });
    }

    const blocking = issues.filter((i) => i.severity === "blocking");
    const warnings = issues.filter((i) => i.severity === "warning");
    const notes = issues.filter((i) => i.severity === "note");

    const effectivelyBlocked = blocking.length > 0 && !overrideApproved;
    const ready = !effectivelyBlocked;

    const report: ReadinessReport = {
      projectRoot,
      targetChapter,
      checkedAt: new Date().toISOString(),
      ready,
      blockingIssues: blocking,
      warnings,
      notes,
      summary: ready
        ? `Chapter ${targetChapter} is ready to draft.${overrideApproved && blocking.length > 0 ? " (Author override applied.)" : ""}`
        : `Chapter ${targetChapter} is NOT ready. Resolve ${blocking.length} blocking issue(s) first.`,
    };

    this.audit.log({
      type: "tool_call",
      filePath: projectRoot,
      outcome: ready ? "success" : "failure",
      details: { action: "checkChapterReadiness", targetChapter, ready, blocking: blocking.length },
    });

    this.saveReport(projectRoot, `readiness-ch${targetChapter}`, report);
    return report;
  }

  // ── Style consistency checker ────────────────────────────────────────────

  checkStyleConsistency(projectRoot: string, chapterNumber: number): StyleConsistencyReport {
    const plan = this.planningService.load(projectRoot);
    const memory = this.memoryService.load(projectRoot);
    const issues: StyleIssue[] = [];

    // Get the latest draft
    const latestVersion = memory.chapterVersions
      .filter((cv) => cv.chapterNumber === chapterNumber)
      .sort((a, b) => b.version - a.version)[0];

    const chapterText = latestVersion && fs.existsSync(latestVersion.filePath)
      ? fs.readFileSync(latestVersion.filePath, "utf-8")
      : "";

    const styleGuide = plan.styleGuide;

    if (!chapterText) {
      return {
        projectRoot,
        chapterNumber,
        checkedAt: new Date().toISOString(),
        issues: [],
        passed: true,
        summary: `No draft found for chapter ${chapterNumber}. Nothing to check.`,
      };
    }

    if (!styleGuide) {
      return {
        projectRoot,
        chapterNumber,
        checkedAt: new Date().toISOString(),
        issues: [],
        passed: true,
        summary: "No style guide defined. Skipping style consistency check.",
      };
    }

    // 1. Do-not-use word/phrase check
    const doNotUse = [
      ...(plan.styleGuide?.doNotUseList ?? []),
    ];
    const projectDoNotUse: string[] = [];
    const allForbidden = [...doNotUse, ...projectDoNotUse];

    for (const term of allForbidden) {
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      const match = chapterText.match(regex);
      if (match) {
        const idx = chapterText.toLowerCase().indexOf(term.toLowerCase());
        const excerpt = chapterText.slice(Math.max(0, idx - 40), idx + term.length + 40).replace(/\n/g, " ");
        issues.push({
          severity: "warning",
          ruleViolated: `do-not-use: "${term}"`,
          excerpt: `…${excerpt}…`,
          suggestion: `Remove or replace "${term}" per style guide do-not-use list.`,
        });
      }
    }

    // 2. Tense consistency check (heuristic)
    if (styleGuide.tenseNotes) {
      const isPresentTense = styleGuide.tenseNotes.toLowerCase().includes("present");
      const isPastTense = styleGuide.tenseNotes.toLowerCase().includes("past");

      if (isPresentTense) {
        // Simple heuristic: look for common past-tense patterns in prose (not dialogue)
        const proseParagraphs = chapterText.split(/\n\n+/).filter((p) => !p.trim().startsWith('"'));
        const pastMarkers = ["walked", "ran", "said", "looked", "turned", "thought", "felt", "heard", "saw", "knew"];
        let pastCount = 0;
        for (const para of proseParagraphs.slice(0, 10)) {
          for (const marker of pastMarkers) {
            if (new RegExp(`\\b${marker}\\b`, "i").test(para)) pastCount++;
          }
        }
        if (pastCount > 5) {
          issues.push({
            severity: "warning",
            ruleViolated: "tense: present tense required",
            excerpt: "(multiple paragraphs)",
            suggestion: `Project is set to present tense but ${pastCount} past-tense markers detected in first 10 paragraphs. Review for tense drift.`,
          });
        }
      } else if (isPastTense) {
        const proseParagraphs = chapterText.split(/\n\n+/).filter((p) => !p.trim().startsWith('"'));
        const presentMarkers = ["walks", "runs", "says", "looks", "turns", "thinks", "feels", "hears", "sees", "knows"];
        let presentCount = 0;
        for (const para of proseParagraphs.slice(0, 10)) {
          for (const marker of presentMarkers) {
            if (new RegExp(`\\b${marker}\\b`, "i").test(para)) presentCount++;
          }
        }
        if (presentCount > 5) {
          issues.push({
            severity: "warning",
            ruleViolated: "tense: past tense required",
            excerpt: "(multiple paragraphs)",
            suggestion: `Project is set to past tense but ${presentCount} present-tense markers detected in first 10 paragraphs. Review for tense drift.`,
          });
        }
      }
    }

    // 3. POV consistency check (heuristic — detect mixed first/third person)
    if (styleGuide.povNotes) {
      const isThirdPerson = styleGuide.povNotes.toLowerCase().includes("third");
      const isFirstPerson = styleGuide.povNotes.toLowerCase().includes("first");
      const firstPersonCount = (chapterText.match(/\b(I|me|my|mine|myself)\b/g) ?? []).length;
      const thirdPersonCount = (chapterText.match(/\b(he|she|they|him|her|his|hers)\b/gi) ?? []).length;

      if (isThirdPerson && firstPersonCount > thirdPersonCount * 0.3 && firstPersonCount > 10) {
        issues.push({
          severity: "warning",
          ruleViolated: "POV: third-person required",
          excerpt: `(${firstPersonCount} first-person pronouns detected)`,
          suggestion: "Project POV is third-person. High first-person pronoun count may indicate a POV slip.",
        });
      } else if (isFirstPerson && thirdPersonCount > firstPersonCount * 0.5 && thirdPersonCount > 10) {
        issues.push({
          severity: "note",
          ruleViolated: "POV: first-person required",
          excerpt: `(${thirdPersonCount} third-person pronouns detected)`,
          suggestion: "Project POV is first-person. Elevated third-person pronoun count may indicate a POV slip.",
        });
      }
    }

    const passed = !issues.some((i) => i.severity === "blocking");

    const report: StyleConsistencyReport = {
      projectRoot,
      chapterNumber,
      checkedAt: new Date().toISOString(),
      issues,
      passed,
      summary: issues.length === 0
        ? `Chapter ${chapterNumber} passes all style checks.`
        : `Chapter ${chapterNumber}: ${issues.length} style issue(s) found (${issues.filter((i) => i.severity === "blocking").length} blocking, ${issues.filter((i) => i.severity === "warning").length} warning).`,
    };

    this.audit.log({
      type: "tool_call",
      filePath: projectRoot,
      outcome: "success",
      details: { action: "checkStyleConsistency", chapterNumber, issueCount: issues.length },
    });

    this.saveReport(projectRoot, `style-ch${chapterNumber}`, report);
    return report;
  }

  // ── Genre contract checker ───────────────────────────────────────────────

  checkGenreContract(projectRoot: string): GenreContractReport {
    const plan = this.planningService.load(projectRoot);
    const memory = this.memoryService.load(projectRoot);
    const issues: GenreContractIssue[] = [];

    const contract = plan.genreContract;
    const primaryGenre = contract?.genres?.[0] ?? "unknown";

    if (!contract) {
      return {
        projectRoot,
        checkedAt: new Date().toISOString(),
        primaryGenre,
        issues: [],
        passed: true,
        summary: "No genre contract defined. Skipping genre contract check.",
      };
    }

    // Check drafts exist for at least some chapters
    const draftedChapters = [...new Set(memory.chapterVersions.map((cv) => cv.chapterNumber))];
    if (draftedChapters.length === 0) {
      return {
        projectRoot,
        checkedAt: new Date().toISOString(),
        primaryGenre,
        issues: [],
        passed: true,
        summary: "No chapter drafts found. Genre contract check skipped.",
      };
    }

    // Aggregate all draft text
    const allText = draftedChapters.map((ch) => {
      const latest = memory.chapterVersions
        .filter((cv) => cv.chapterNumber === ch)
        .sort((a, b) => b.version - a.version)[0];
      if (!latest || !fs.existsSync(latest.filePath)) return "";
      return fs.readFileSync(latest.filePath, "utf-8");
    }).join("\n\n");

    const wordCount = allText.split(/\s+/).filter(Boolean).length;

    // Genre-specific heuristic checks
    const genreChecks: Record<string, () => void> = {
      "sci-fi": () => {
        // Expect some world-building / technical vocabulary
        const scifiTerms = ["station", "orbit", "system", "data", "engineer", "code", "scan", "signal", "technology", "energy"];
        const found = scifiTerms.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(allText));
        if (found.length < 3 && wordCount > 3000) {
          issues.push({
            severity: "note",
            expectation: "Sci-fi genre typically features technical vocabulary and world-building language.",
            observation: `Only ${found.length} of ${scifiTerms.length} sample sci-fi terms detected.`,
            suggestion: "Review whether the manuscript establishes the sci-fi setting adequately.",
          });
        }
      },
      "thriller": () => {
        const openThreadCount = Object.values(memory.plotThreads).filter((t) => t.threadStatus === "open").length;
        if (openThreadCount === 0 && draftedChapters.length > 3) {
          issues.push({
            severity: "warning",
            expectation: "Thriller genre requires sustained tension through unresolved plot threads.",
            observation: "No open plot threads recorded after multiple chapters.",
            suggestion: "Add unresolved plot threads to maintain reader tension.",
          });
        }
      },
      "romance": () => {
        const protagonistCount = Object.values(memory.characters).filter(
          (c) => c.role === "protagonist" && c.status === "active"
        ).length;
        if (protagonistCount < 2) {
          issues.push({
            severity: "note",
            expectation: "Romance genre typically has two central protagonists.",
            observation: `Only ${protagonistCount} active protagonist(s) found.`,
            suggestion: "Ensure both romantic leads are registered as protagonists.",
          });
        }
      },
    };

    const normalizedGenre = primaryGenre.toLowerCase().replace(/[-_ ]/g, "");
    for (const [key, check] of Object.entries(genreChecks)) {
      if (normalizedGenre.includes(key.replace(/[-_ ]/g, ""))) {
        check();
      }
    }

    // Check that mandatory promises in the contract have some presence in the text
    if (contract.promises && contract.promises.length > 0) {
      for (const entry of contract.promises.filter((p) => p.mandatory)) {
        const terms = entry.promise.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        const anyPresent = terms.some((t) => allText.toLowerCase().includes(t));
        if (!anyPresent && wordCount > 2000) {
          issues.push({
            severity: "note",
            expectation: `Genre contract mandatory promise: "${entry.promise}"`,
            observation: "None of the key terms from this requirement were found in draft text.",
            suggestion: `Consider whether "${entry.promise}" has been addressed in your chapters.`,
          });
        }
      }
    }

    const passed = !issues.some((i) => i.severity === "blocking");

    const report: GenreContractReport = {
      projectRoot,
      checkedAt: new Date().toISOString(),
      primaryGenre,
      issues,
      passed,
      summary: issues.length === 0
        ? `Genre contract check passed for "${primaryGenre}".`
        : `Genre contract: ${issues.length} issue(s) for "${primaryGenre}" (${issues.filter((i) => i.severity === "blocking").length} blocking, ${issues.filter((i) => i.severity === "warning").length} warning, ${issues.filter((i) => i.severity === "note").length} note).`,
    };

    this.audit.log({
      type: "tool_call",
      filePath: projectRoot,
      outcome: "success",
      details: { action: "checkGenreContract", primaryGenre, issueCount: issues.length },
    });

    this.saveReport(projectRoot, "genre-contract", report);
    return report;
  }

  // ── Pacing checker ───────────────────────────────────────────────────────

  checkPacing(projectRoot: string): PacingReport {
    const memory = this.memoryService.load(projectRoot);
    const draftedChapters = [...new Set(memory.chapterVersions.map((cv) => cv.chapterNumber))].sort((a, b) => a - b);

    const chapters: ChapterPacingInfo[] = [];

    for (const ch of draftedChapters) {
      const latest = memory.chapterVersions
        .filter((cv) => cv.chapterNumber === ch)
        .sort((a, b) => b.version - a.version)[0];
      if (!latest || !fs.existsSync(latest.filePath)) continue;

      const text = fs.readFileSync(latest.filePath, "utf-8");
      const paragraphs = text.split(/\n\n+/).filter(Boolean);
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const dialogueLines = paragraphs.filter((p) => p.trim().startsWith('"') || p.trim().startsWith('“'));
      const dialogueRatio = paragraphs.length > 0 ? dialogueLines.length / paragraphs.length : 0;
      const avgParaLen = paragraphs.length > 0 ? wordCount / paragraphs.length : 0;

      // Pacing label heuristic
      let pacingLabel: "fast" | "moderate" | "slow";
      if (avgParaLen < 50 || dialogueRatio > 0.5) {
        pacingLabel = "fast";
      } else if (avgParaLen > 150) {
        pacingLabel = "slow";
      } else {
        pacingLabel = "moderate";
      }

      chapters.push({
        chapterNumber: ch,
        wordCount,
        paragraphCount: paragraphs.length,
        dialogueRatio: Math.round(dialogueRatio * 100) / 100,
        averageParagraphLength: Math.round(avgParaLen),
        pacingLabel,
      });
    }

    const overallNotes: string[] = [];

    if (chapters.length > 1) {
      const wordCounts = chapters.map((c) => c.wordCount);
      const avg = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
      const max = Math.max(...wordCounts);
      const min = Math.min(...wordCounts);
      if (max > avg * 2) {
        const longCh = chapters.find((c) => c.wordCount === max);
        overallNotes.push(`Chapter ${longCh?.chapterNumber} is unusually long (${max} words vs average ${Math.round(avg)}). Consider splitting.`);
      }
      if (min < avg * 0.4) {
        const shortCh = chapters.find((c) => c.wordCount === min);
        overallNotes.push(`Chapter ${shortCh?.chapterNumber} is unusually short (${min} words vs average ${Math.round(avg)}). Consider expanding.`);
      }

      // Detect consecutive slow chapters
      let slowRun = 0;
      for (const ch of chapters) {
        if (ch.pacingLabel === "slow") {
          slowRun++;
          if (slowRun >= 3) {
            overallNotes.push(`Chapters ${ch.chapterNumber - 2}–${ch.chapterNumber} are all paced slowly. Consider adding a tension beat.`);
            break;
          }
        } else {
          slowRun = 0;
        }
      }
    }

    if (chapters.length === 0) {
      overallNotes.push("No chapter drafts found. Pacing analysis skipped.");
    }

    const report: PacingReport = {
      projectRoot,
      checkedAt: new Date().toISOString(),
      chapters,
      overallNotes,
      summary: chapters.length === 0
        ? "No drafts to analyse."
        : `Pacing analysed across ${chapters.length} chapter(s). ${overallNotes.length} note(s).`,
    };

    this.audit.log({
      type: "tool_call",
      filePath: projectRoot,
      outcome: "success",
      details: { action: "checkPacing", chapterCount: chapters.length },
    });

    this.saveReport(projectRoot, "pacing", report);
    return report;
  }

  // ── Report persistence ───────────────────────────────────────────────────

  private saveReport(projectRoot: string, name: string, data: unknown): void {
    const reportsDir = path.join(projectRoot, "reports");
    fs.mkdirSync(reportsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filePath = path.join(reportsDir, `${name}-${timestamp}.json`);
    this.pathService.atomicWrite(filePath, JSON.stringify(data, null, 2));
  }
}
