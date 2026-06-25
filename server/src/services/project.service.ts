import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ProjectMetadata, ProjectSettings, ProjectStatus } from "../types/project.js";
import { PathService } from "./path.service.js";
import { AuditService } from "./audit.service.js";

export const PROJECT_DIRS = [
  "outline",
  "characters",
  "world",
  "research",
  "drafts",
  "revisions",
  "exports",
  "continuity",
  "memory",
  "memory/archive",
  "logs",
  "style",
];

export class ProjectService {
  constructor(
    private pathService: PathService,
    private audit: AuditService
  ) {}

  create(settings: ProjectSettings, parentDir: string): ProjectMetadata {
    const resolvedParent = this.pathService.resolve(parentDir);
    const id = crypto.randomUUID();
    const slug = settings.workingTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    const projectRoot = path.join(resolvedParent, `${slug}-${id.slice(0, 8)}`);

    fs.mkdirSync(projectRoot, { recursive: true });
    for (const dir of PROJECT_DIRS) {
      fs.mkdirSync(path.join(projectRoot, dir), { recursive: true });
    }

    const now = new Date().toISOString();
    const meta: ProjectMetadata = {
      id,
      createdAt: now,
      updatedAt: now,
      status: "planning",
      settings,
      projectRoot,
      currentDraftVersion: 0,
      currentOutlineVersion: 0,
      wordCountActual: 0,
    };

    this.pathService.atomicWrite(
      path.join(projectRoot, "project.json"),
      JSON.stringify(meta, null, 2)
    );

    this.audit.log({
      type: "project_create",
      projectId: id,
      filePath: projectRoot,
      outcome: "success",
      details: { title: settings.workingTitle },
    });

    return meta;
  }

  load(projectRoot: string): ProjectMetadata {
    const resolved = this.pathService.resolve(projectRoot);
    const metaPath = path.join(resolved, "project.json");

    if (!fs.existsSync(metaPath)) {
      throw new Error(`No project.json found at ${metaPath}`);
    }

    const raw = fs.readFileSync(metaPath, "utf-8");
    const meta = JSON.parse(raw) as ProjectMetadata;
    this.validateMetadata(meta);

    this.audit.log({
      type: "project_load",
      projectId: meta.id,
      filePath: resolved,
      outcome: "success",
    });

    return meta;
  }

  save(meta: ProjectMetadata): void {
    meta.updatedAt = new Date().toISOString();
    const metaPath = path.join(meta.projectRoot, "project.json");
    this.pathService.atomicWrite(metaPath, JSON.stringify(meta, null, 2));
  }

  list(rootDir: string): ProjectMetadata[] {
    const resolved = this.pathService.resolve(rootDir);
    if (!fs.existsSync(resolved)) return [];
    const results: ProjectMetadata[] = [];
    for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const metaPath = path.join(resolved, entry.name, "project.json");
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as ProjectMetadata;
          results.push(meta);
        } catch {
          /* skip corrupt project.json */
        }
      }
    }
    return results;
  }

  updateStatus(meta: ProjectMetadata, status: ProjectStatus): void {
    meta.status = status;
    this.save(meta);
  }

  private validateMetadata(meta: ProjectMetadata): void {
    if (!meta.id || !meta.settings?.workingTitle || !meta.projectRoot) {
      throw new Error("project.json is missing required fields (id, settings.workingTitle, projectRoot)");
    }
  }
}
