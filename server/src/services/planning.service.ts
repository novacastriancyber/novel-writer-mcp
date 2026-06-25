import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  ProjectPlan,
  Premise,
  Synopsis,
  SynopsisLength,
  GenreContract,
  GenreContractEntry,
  StyleGuide,
  StyleProfileEntry,
  StructurePlan,
  StructureModel,
  Act,
  ChapterBrief,
  SceneBrief,
} from "../types/planning.js";
import { PathService } from "./path.service.js";
import { AuditService } from "./audit.service.js";

const PLAN_FILE = "outline/plan.json";

export class PlanningService {
  constructor(
    private pathService: PathService,
    private audit: AuditService
  ) {}

  // ── Load / Save ──────────────────────────────────────────────────────────

  load(projectRoot: string): ProjectPlan {
    const filePath = path.join(projectRoot, PLAN_FILE);
    if (!fs.existsSync(filePath)) {
      return this.empty(path.basename(projectRoot));
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ProjectPlan;
  }

  save(projectRoot: string, plan: ProjectPlan): void {
    plan.updatedAt = new Date().toISOString();
    this.pathService.atomicWrite(
      path.join(projectRoot, PLAN_FILE),
      JSON.stringify(plan, null, 2)
    );
    this.audit.log({ type: "file_write", filePath: path.join(projectRoot, PLAN_FILE), outcome: "success" });
  }

  private empty(projectId: string): ProjectPlan {
    return {
      projectId,
      synopses: [],
      chapterBriefs: [],
      sceneBriefs: [],
      updatedAt: new Date().toISOString(),
    };
  }

  // ── Premise ──────────────────────────────────────────────────────────────

  savePremise(projectRoot: string, ideaSource: string, premise: string, logline: string): Premise {
    const plan = this.load(projectRoot);
    const now = new Date().toISOString();
    const existing = plan.premise;

    const saved: Premise = {
      id: existing?.id ?? `premise-${crypto.randomUUID().slice(0, 8)}`,
      ideaSource,
      premise,
      logline,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      this.archivePlanRecord(projectRoot, "premise", existing);
    }

    plan.premise = saved;
    this.save(projectRoot, plan);
    return saved;
  }

  getPremise(projectRoot: string): Premise | undefined {
    return this.load(projectRoot).premise;
  }

  // ── Synopsis ─────────────────────────────────────────────────────────────

  saveSynopsis(projectRoot: string, length: SynopsisLength, content: string): Synopsis {
    const plan = this.load(projectRoot);
    const now = new Date().toISOString();
    const existing = plan.synopses.find((s) => s.length === length);

    const synopsis: Synopsis = {
      id: existing?.id ?? `synopsis-${length}-${crypto.randomUUID().slice(0, 8)}`,
      length,
      content,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      this.archivePlanRecord(projectRoot, `synopsis-${length}`, existing);
      plan.synopses = plan.synopses.filter((s) => s.length !== length);
    }

    plan.synopses.push(synopsis);
    this.save(projectRoot, plan);

    const fileName = `synopsis-${length}-v${synopsis.version}.md`;
    this.pathService.atomicWrite(path.join(projectRoot, "outline", fileName), content);
    return synopsis;
  }

  getSynopsis(projectRoot: string, length: SynopsisLength): Synopsis | undefined {
    return this.load(projectRoot).synopses.find((s) => s.length === length);
  }

  // ── Genre Contract ────────────────────────────────────────────────────────

  saveGenreContract(
    projectRoot: string,
    genres: string[],
    promises: GenreContractEntry[],
    readerExpectations: string[],
    tropeGuidance: string[]
  ): GenreContract {
    const plan = this.load(projectRoot);
    const now = new Date().toISOString();
    const existing = plan.genreContract;

    const contract: GenreContract = {
      id: existing?.id ?? `genre-contract-${crypto.randomUUID().slice(0, 8)}`,
      genres,
      promises,
      readerExpectations,
      tropeGuidance,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) this.archivePlanRecord(projectRoot, "genre-contract", existing);
    plan.genreContract = contract;
    this.save(projectRoot, plan);

    this.pathService.atomicWrite(
      path.join(projectRoot, "style", `genre-contract-v${contract.version}.json`),
      JSON.stringify(contract, null, 2)
    );
    return contract;
  }

  // ── Style Guide ───────────────────────────────────────────────────────────

  saveStyleGuide(
    projectRoot: string,
    input: Omit<StyleGuide, "id" | "version" | "createdAt" | "updatedAt">
  ): StyleGuide {
    const plan = this.load(projectRoot);
    const now = new Date().toISOString();
    const existing = plan.styleGuide;

    const guide: StyleGuide = {
      ...input,
      id: existing?.id ?? `style-guide-${crypto.randomUUID().slice(0, 8)}`,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) this.archivePlanRecord(projectRoot, "style-guide", existing);
    plan.styleGuide = guide;
    this.save(projectRoot, plan);

    this.pathService.atomicWrite(
      path.join(projectRoot, "style", `style-guide-v${guide.version}.json`),
      JSON.stringify(guide, null, 2)
    );
    return guide;
  }

  // ── Structure Plan ────────────────────────────────────────────────────────

  saveStructurePlan(
    projectRoot: string,
    model: StructureModel,
    acts: Act[],
    totalChapters: number,
    customName?: string
  ): StructurePlan {
    const plan = this.load(projectRoot);
    const now = new Date().toISOString();
    const existing = plan.structurePlan;

    const structure: StructurePlan = {
      id: existing?.id ?? `structure-${crypto.randomUUID().slice(0, 8)}`,
      model,
      customName,
      acts,
      totalChapters,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) this.archivePlanRecord(projectRoot, "structure", existing);
    plan.structurePlan = structure;
    this.save(projectRoot, plan);

    this.pathService.atomicWrite(
      path.join(projectRoot, "outline", `structure-v${structure.version}.json`),
      JSON.stringify(structure, null, 2)
    );
    return structure;
  }

  getStructureTemplate(model: StructureModel): Act[] {
    const templates: Record<StructureModel, Act[]> = {
      "three-act": [
        { number: 1, name: "Act One — Setup", purpose: "Establish world, character, and stakes. End with inciting incident.", chapterRange: [1, 4], keyTurningPoint: "Inciting incident forces protagonist into the story" },
        { number: 2, name: "Act Two — Confrontation", purpose: "Escalating obstacles. Midpoint reversal. Dark night of the soul.", chapterRange: [5, 11], keyTurningPoint: "Midpoint raises stakes; all-is-lost moment before Act Three" },
        { number: 3, name: "Act Three — Resolution", purpose: "Final confrontation and resolution. Cost must be paid.", chapterRange: [12, 15], keyTurningPoint: "Climax forces the protagonist's defining choice" },
      ],
      "hero-journey": [
        { number: 1, name: "Ordinary World", purpose: "Establish hero's normal world before the adventure.", chapterRange: [1, 2], keyTurningPoint: "Call to adventure" },
        { number: 2, name: "Special World", purpose: "Tests, allies, enemies. Approach to the innermost cave.", chapterRange: [3, 9], keyTurningPoint: "Ordeal — hero faces greatest fear" },
        { number: 3, name: "Return", purpose: "Road back, resurrection, return with the elixir.", chapterRange: [10, 15], keyTurningPoint: "Resurrection — hero transformed" },
      ],
      "save-the-cat": [
        { number: 1, name: "Act One", purpose: "Opening image, setup, theme stated, catalyst, debate.", chapterRange: [1, 3], keyTurningPoint: "Break into Two — protagonist enters new world" },
        { number: 2, name: "Act Two A", purpose: "Fun and games, B story, midpoint.", chapterRange: [4, 8], keyTurningPoint: "Midpoint — false victory or false defeat" },
        { number: 3, name: "Act Two B", purpose: "Bad guys close in, all is lost, dark night of the soul.", chapterRange: [9, 12], keyTurningPoint: "Break into Three — protagonist finds solution" },
        { number: 4, name: "Act Three", purpose: "Finale, closing image.", chapterRange: [13, 15], keyTurningPoint: "Climax resolves all threads" },
      ],
      "five-act": [
        { number: 1, name: "Exposition", purpose: "Establish characters and situation.", chapterRange: [1, 2], keyTurningPoint: "Inciting incident" },
        { number: 2, name: "Rising Action", purpose: "Complications and escalation.", chapterRange: [3, 6], keyTurningPoint: "Point of no return" },
        { number: 3, name: "Climax", purpose: "Peak tension and confrontation.", chapterRange: [7, 9], keyTurningPoint: "Crisis decision" },
        { number: 4, name: "Falling Action", purpose: "Consequences of the climax.", chapterRange: [10, 12], keyTurningPoint: "Reversal or revelation" },
        { number: 5, name: "Resolution", purpose: "New equilibrium established.", chapterRange: [13, 15], keyTurningPoint: "Final image" },
      ],
      "fichtean-curve": [
        { number: 1, name: "Rising Crises", purpose: "Series of escalating crises with no traditional setup.", chapterRange: [1, 10], keyTurningPoint: "Major crisis at midpoint" },
        { number: 2, name: "Climax and Fall", purpose: "Final crisis and resolution.", chapterRange: [11, 15], keyTurningPoint: "Ultimate crisis resolved" },
      ],
      "story-circle": [
        { number: 1, name: "You", purpose: "Character in their zone of comfort.", chapterRange: [1, 2], keyTurningPoint: "Character wants something" },
        { number: 2, name: "Need", purpose: "Character enters unfamiliar situation.", chapterRange: [3, 5], keyTurningPoint: "Adapts to it" },
        { number: 3, name: "Go", purpose: "Character gets what they wanted.", chapterRange: [6, 9], keyTurningPoint: "Pays a heavy price" },
        { number: 4, name: "Return", purpose: "Character returns to familiar situation having changed.", chapterRange: [10, 15], keyTurningPoint: "Can now truly rest" },
      ],
      "custom": [],
    };
    return templates[model] ?? [];
  }

  // ── Chapter Briefs ────────────────────────────────────────────────────────

  saveChapterBrief(projectRoot: string, brief: Omit<ChapterBrief, "version" | "createdAt" | "updatedAt">): ChapterBrief {
    const plan = this.load(projectRoot);
    const now = new Date().toISOString();
    const existing = plan.chapterBriefs.find((b) => b.chapterNumber === brief.chapterNumber);

    const saved: ChapterBrief = {
      ...brief,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) this.archivePlanRecord(projectRoot, `chapter-brief-${brief.chapterNumber}`, existing);
    plan.chapterBriefs = plan.chapterBriefs.filter((b) => b.chapterNumber !== brief.chapterNumber);
    plan.chapterBriefs.push(saved);
    plan.chapterBriefs.sort((a, b) => a.chapterNumber - b.chapterNumber);
    this.save(projectRoot, plan);
    return saved;
  }

  getChapterBrief(projectRoot: string, chapterNumber: number): ChapterBrief | undefined {
    return this.load(projectRoot).chapterBriefs.find((b) => b.chapterNumber === chapterNumber);
  }

  listChapterBriefs(projectRoot: string): ChapterBrief[] {
    return this.load(projectRoot).chapterBriefs;
  }

  // ── Scene Briefs ──────────────────────────────────────────────────────────

  saveSceneBrief(projectRoot: string, brief: Omit<SceneBrief, "version" | "createdAt" | "updatedAt">): SceneBrief {
    const plan = this.load(projectRoot);
    const now = new Date().toISOString();
    const existing = plan.sceneBriefs.find(
      (s) => s.chapterNumber === brief.chapterNumber && s.sceneNumber === brief.sceneNumber
    );

    const saved: SceneBrief = {
      ...brief,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) this.archivePlanRecord(projectRoot, `scene-brief-${brief.chapterNumber}-${brief.sceneNumber}`, existing);
    plan.sceneBriefs = plan.sceneBriefs.filter(
      (s) => !(s.chapterNumber === brief.chapterNumber && s.sceneNumber === brief.sceneNumber)
    );
    plan.sceneBriefs.push(saved);
    plan.sceneBriefs.sort((a, b) => a.chapterNumber !== b.chapterNumber ? a.chapterNumber - b.chapterNumber : a.sceneNumber - b.sceneNumber);
    this.save(projectRoot, plan);
    return saved;
  }

  listScenesForChapter(projectRoot: string, chapterNumber: number): SceneBrief[] {
    return this.load(projectRoot).sceneBriefs.filter((s) => s.chapterNumber === chapterNumber);
  }

  // ── Draft readiness ───────────────────────────────────────────────────────

  checkDraftReadiness(projectRoot: string): { ready: boolean; missing: string[]; warnings: string[] } {
    const plan = this.load(projectRoot);
    const missing: string[] = [];
    const warnings: string[] = [];

    if (!plan.premise) missing.push("Premise not defined");
    if (!plan.synopses.find((s) => s.length === "short")) missing.push("Short synopsis not written");
    if (!plan.genreContract) missing.push("Genre contract not defined");
    if (!plan.styleGuide) missing.push("Style guide not defined");
    if (!plan.structurePlan) missing.push("Structure plan not defined");
    if (plan.chapterBriefs.length === 0) missing.push("No chapter briefs created");

    if (plan.structurePlan && plan.chapterBriefs.length < plan.structurePlan.totalChapters) {
      warnings.push(`${plan.chapterBriefs.length} of ${plan.structurePlan.totalChapters} chapter briefs complete`);
    }

    if (plan.styleGuide && plan.styleGuide.doNotUseList.length === 0) {
      warnings.push("Do-not-use list is empty — consider adding genre clichés to avoid");
    }

    return { ready: missing.length === 0, missing, warnings };
  }

  // ── Archive ───────────────────────────────────────────────────────────────

  private archivePlanRecord(projectRoot: string, type: string, record: unknown): void {
    const archiveDir = path.join(projectRoot, "memory", "archive");
    fs.mkdirSync(archiveDir, { recursive: true });
    const fileName = `plan-${type}-v${(record as { version: number }).version}-${Date.now()}.json`;
    this.pathService.atomicWrite(
      path.join(archiveDir, fileName),
      JSON.stringify(record, null, 2)
    );
  }
}
