import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  ProjectMemory,
  Character,
  Location,
  PlotThread,
  ResearchNote,
  ContinuityRecord,
  ChapterVersion,
  OutlineVersion,
  RecordStatus,
} from "../types/memory.js";
import { PathService } from "./path.service.js";
import { AuditService } from "./audit.service.js";

const MEMORY_FILE = "memory/memory.json";

export class MemoryService {
  constructor(
    private pathService: PathService,
    private audit: AuditService
  ) {}

  // ── Load / Save ─────────────────────────────────────────────────────────

  load(projectRoot: string): ProjectMemory {
    const filePath = path.join(projectRoot, MEMORY_FILE);
    if (!fs.existsSync(filePath)) {
      return this.empty(path.basename(projectRoot));
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ProjectMemory;
  }

  save(projectRoot: string, memory: ProjectMemory): void {
    memory.updatedAt = new Date().toISOString();
    this.pathService.atomicWrite(
      path.join(projectRoot, MEMORY_FILE),
      JSON.stringify(memory, null, 2)
    );
  }

  private empty(projectId: string): ProjectMemory {
    return {
      projectId,
      characters: {},
      locations: {},
      plotThreads: {},
      researchNotes: {},
      continuityRecords: [],
      chapterVersions: [],
      outlineVersions: [],
      updatedAt: new Date().toISOString(),
    };
  }

  // ── Characters ───────────────────────────────────────────────────────────

  upsertCharacter(projectRoot: string, input: Omit<Character, "id" | "createdAt" | "updatedAt" | "version" | "status"> & { id?: string }): Character {
    const memory = this.load(projectRoot);
    const now = new Date().toISOString();
    const existing = input.id ? memory.characters[input.id] : undefined;

    const character: Character = {
      ...input,
      id: existing?.id ?? `char-${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      this.archiveRecord(projectRoot, "character", existing);
    }

    memory.characters[character.id] = character;
    this.save(projectRoot, memory);
    this.audit.log({ type: "file_write", projectId: memory.projectId, filePath: `characters/${character.id}`, outcome: "success" });
    return character;
  }

  archiveCharacter(projectRoot: string, characterId: string): void {
    const memory = this.load(projectRoot);
    const char = memory.characters[characterId];
    if (!char) throw new Error(`Character not found: ${characterId}`);
    this.archiveRecord(projectRoot, "character", char);
    char.status = "archived";
    char.updatedAt = new Date().toISOString();
    this.save(projectRoot, memory);
  }

  // ── Locations ────────────────────────────────────────────────────────────

  upsertLocation(projectRoot: string, input: Omit<Location, "id" | "createdAt" | "updatedAt" | "version" | "status"> & { id?: string }): Location {
    const memory = this.load(projectRoot);
    const now = new Date().toISOString();
    const existing = input.id ? memory.locations[input.id] : undefined;

    const location: Location = {
      ...input,
      id: existing?.id ?? `loc-${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      this.archiveRecord(projectRoot, "location", existing);
    }

    memory.locations[location.id] = location;
    this.save(projectRoot, memory);
    return location;
  }

  archiveLocation(projectRoot: string, locationId: string): void {
    const memory = this.load(projectRoot);
    const loc = memory.locations[locationId];
    if (!loc) throw new Error(`Location not found: ${locationId}`);
    this.archiveRecord(projectRoot, "location", loc);
    loc.status = "archived";
    loc.updatedAt = new Date().toISOString();
    this.save(projectRoot, memory);
  }

  // ── Plot Threads ─────────────────────────────────────────────────────────

  upsertThread(projectRoot: string, input: Omit<PlotThread, "id" | "createdAt" | "updatedAt" | "version" | "status"> & { id?: string }): PlotThread {
    const memory = this.load(projectRoot);
    const now = new Date().toISOString();
    const existing = input.id ? memory.plotThreads[input.id] : undefined;

    const thread: PlotThread = {
      ...input,
      id: existing?.id ?? `thread-${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      this.archiveRecord(projectRoot, "thread", existing);
    }

    memory.plotThreads[thread.id] = thread;
    this.save(projectRoot, memory);
    return thread;
  }

  archiveThread(projectRoot: string, threadId: string): void {
    const memory = this.load(projectRoot);
    const thread = memory.plotThreads[threadId];
    if (!thread) throw new Error(`Plot thread not found: ${threadId}`);
    this.archiveRecord(projectRoot, "thread", thread);
    thread.status = "archived";
    thread.updatedAt = new Date().toISOString();
    this.save(projectRoot, memory);
  }

  listOpenThreads(projectRoot: string): PlotThread[] {
    const memory = this.load(projectRoot);
    return Object.values(memory.plotThreads).filter(
      (t) => t.status === "active" && (t.threadStatus === "open" || t.threadStatus === "advanced")
    );
  }

  // ── Research Notes ───────────────────────────────────────────────────────

  upsertResearchNote(projectRoot: string, input: Omit<ResearchNote, "id" | "createdAt" | "updatedAt" | "status"> & { id?: string }): ResearchNote {
    const memory = this.load(projectRoot);
    const now = new Date().toISOString();
    const existing = input.id ? memory.researchNotes[input.id] : undefined;

    const note: ResearchNote = {
      ...input,
      id: existing?.id ?? `research-${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    memory.researchNotes[note.id] = note;
    this.save(projectRoot, memory);
    return note;
  }

  // ── Continuity Records ───────────────────────────────────────────────────

  addContinuityFact(projectRoot: string, input: Omit<ContinuityRecord, "id" | "createdAt">): ContinuityRecord {
    const memory = this.load(projectRoot);
    const record: ContinuityRecord = {
      ...input,
      id: `cont-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    memory.continuityRecords.push(record);
    this.save(projectRoot, memory);
    return record;
  }

  getContinuityByChapter(projectRoot: string, chapterNumber: number): ContinuityRecord[] {
    const memory = this.load(projectRoot);
    return memory.continuityRecords.filter((r) => r.establishedInChapter <= chapterNumber);
  }

  // ── Versioning ───────────────────────────────────────────────────────────

  saveChapterVersion(projectRoot: string, chapterNumber: number, content: string, notes?: string): ChapterVersion {
    const memory = this.load(projectRoot);
    const existing = memory.chapterVersions.filter((v) => v.chapterNumber === chapterNumber);
    const nextVersion = (existing.at(-1)?.version ?? 0) + 1;

    const versionDir = path.join(projectRoot, "revisions", `chapter-${String(chapterNumber).padStart(2, "0")}`);
    fs.mkdirSync(versionDir, { recursive: true });

    const fileName = `chapter-${String(chapterNumber).padStart(2, "0")}-v${nextVersion}.md`;
    const filePath = path.join(versionDir, fileName);
    this.pathService.atomicWrite(filePath, content);

    const words = content.split(/\s+/).filter(Boolean).length;

    const version: ChapterVersion = {
      chapterNumber,
      version: nextVersion,
      filePath,
      wordCount: words,
      createdAt: new Date().toISOString(),
      notes,
      approved: false,
    };

    memory.chapterVersions.push(version);

    const draftPath = path.join(projectRoot, "drafts", `chapter-${String(chapterNumber).padStart(2, "0")}-v${nextVersion}.md`);
    this.pathService.atomicWrite(draftPath, content);

    this.save(projectRoot, memory);
    this.audit.log({ type: "file_write", projectId: memory.projectId, filePath, outcome: "success", details: { chapterNumber, version: nextVersion, wordCount: words } });
    return version;
  }

  approveChapterVersion(projectRoot: string, chapterNumber: number, version: number): void {
    const memory = this.load(projectRoot);
    const v = memory.chapterVersions.find((cv) => cv.chapterNumber === chapterNumber && cv.version === version);
    if (!v) throw new Error(`Chapter ${chapterNumber} v${version} not found`);
    v.approved = true;
    this.save(projectRoot, memory);
  }

  saveOutlineVersion(projectRoot: string, content: string, notes?: string): OutlineVersion {
    const memory = this.load(projectRoot);
    const nextVersion = (memory.outlineVersions.at(-1)?.version ?? 0) + 1;

    const fileName = `outline-v${nextVersion}.md`;
    const filePath = path.join(projectRoot, "outline", fileName);
    this.pathService.atomicWrite(filePath, content);

    const version: OutlineVersion = {
      version: nextVersion,
      filePath,
      createdAt: new Date().toISOString(),
      notes,
    };

    memory.outlineVersions.push(version);
    this.save(projectRoot, memory);
    return version;
  }

  getLatestChapterVersion(projectRoot: string, chapterNumber: number): ChapterVersion | undefined {
    const memory = this.load(projectRoot);
    return memory.chapterVersions
      .filter((v) => v.chapterNumber === chapterNumber)
      .at(-1);
  }

  // ── Archive helpers ──────────────────────────────────────────────────────

  private archiveRecord(projectRoot: string, type: string, record: unknown): void {
    const archiveDir = path.join(projectRoot, "memory", "archive");
    fs.mkdirSync(archiveDir, { recursive: true });
    const fileName = `${type}-${(record as { id: string }).id}-v${(record as { version: number }).version}-${Date.now()}.json`;
    this.pathService.atomicWrite(
      path.join(archiveDir, fileName),
      JSON.stringify(record, null, 2)
    );
  }

  listArchivedRecords(projectRoot: string): string[] {
    const archiveDir = path.join(projectRoot, "memory", "archive");
    if (!fs.existsSync(archiveDir)) return [];
    return fs.readdirSync(archiveDir).filter((f) => f.endsWith(".json"));
  }
}
