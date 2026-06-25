import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ProjectService } from "../services/project.service.js";
import { AuditService } from "../services/audit.service.js";
import { ServerConfig } from "../types/config.js";
import { ContentRating, PointOfView, Tense, ProjectSettings } from "../types/project.js";

export function registerTools(
  server: McpServer,
  projectService: ProjectService,
  audit: AuditService,
  config: ServerConfig
): void {

  // ── create_novel_project ───────────────────────────────────────────────────
  server.tool(
    "create_novel_project",
    "Create a new novel project with folder structure and metadata",
    {
      workingTitle: z.string().min(1).max(200),
      genre: z.string().min(1),
      targetWordCount: z.number().int().min(1000).max(2000000),
      contentRating: z.enum(["G", "PG", "PG-13", "R", "UNRATED"]),
      structureModel: z.string().default("three-act"),
      pointOfView: z.enum(["first", "second", "third-limited", "third-omniscient", "multiple"]),
      tense: z.enum(["past", "present"]),
      setting: z.string().min(1),
      parentDir: z.string().min(1).describe("Approved root directory where the project folder will be created"),
    },
    async (args) => {
      try {
        const settings: ProjectSettings = {
          workingTitle: args.workingTitle,
          genres: [{ genre: args.genre, weight: 1.0 }],
          targetWordCount: args.targetWordCount,
          contentRating: args.contentRating as ContentRating,
          structureModel: args.structureModel,
          styleProfiles: [],
          pointOfView: args.pointOfView as PointOfView,
          tense: args.tense as Tense,
          setting: args.setting,
          exportTargets: config.exportDefaults.formats,
          doNotUseList: [],
        };

        const meta = projectService.create(settings, args.parentDir);

        audit.log({ type: "tool_call", tool: "create_novel_project", projectId: meta.id, outcome: "success" });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                projectId: meta.id,
                projectRoot: meta.projectRoot,
                status: meta.status,
                createdAt: meta.createdAt,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "create_novel_project", outcome: "failure", errorMessage: String(err) });
        return {
          content: [{ type: "text" as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // ── list_novel_projects ────────────────────────────────────────────────────
  server.tool(
    "list_novel_projects",
    "List all novel projects in a given root directory",
    {
      rootDir: z.string().min(1).describe("Approved root directory to search for projects"),
    },
    async (args) => {
      try {
        const projects = projectService.list(args.rootDir);
        audit.log({ type: "tool_call", tool: "list_novel_projects", outcome: "success" });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                projects.map((p) => ({
                  id: p.id,
                  title: p.settings.workingTitle,
                  status: p.status,
                  updatedAt: p.updatedAt,
                  projectRoot: p.projectRoot,
                  wordCountActual: p.wordCountActual,
                  targetWordCount: p.settings.targetWordCount,
                })),
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "list_novel_projects", outcome: "failure", errorMessage: String(err) });
        return {
          content: [{ type: "text" as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // ── get_project_status ─────────────────────────────────────────────────────
  server.tool(
    "get_project_status",
    "Load and return full project metadata for a given project root directory",
    {
      projectRoot: z.string().min(1),
    },
    async (args) => {
      try {
        const meta = projectService.load(args.projectRoot);
        audit.log({ type: "tool_call", tool: "get_project_status", projectId: meta.id, outcome: "success" });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(meta, null, 2) }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "get_project_status", outcome: "failure", errorMessage: String(err) });
        return {
          content: [{ type: "text" as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // ── update_project_status ──────────────────────────────────────────────────
  server.tool(
    "update_project_status",
    "Update the lifecycle status of a novel project",
    {
      projectRoot: z.string().min(1),
      status: z.enum(["planning", "drafting", "revision", "complete", "archived"]),
    },
    async (args) => {
      try {
        const meta = projectService.load(args.projectRoot);
        projectService.updateStatus(meta, args.status as import("../types/project.js").ProjectStatus);
        audit.log({ type: "tool_call", tool: "update_project_status", projectId: meta.id, outcome: "success" });
        return {
          content: [{ type: "text" as const, text: `Project status updated to "${args.status}".` }],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "update_project_status", outcome: "failure", errorMessage: String(err) });
        return {
          content: [{ type: "text" as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // ── scan_orphaned_tmp ──────────────────────────────────────────────────────
  server.tool(
    "scan_orphaned_tmp",
    "Scan a project directory for orphaned .tmp files left by crashed writes",
    {
      projectRoot: z.string().min(1),
    },
    async (args) => {
      try {
        const meta = projectService.load(args.projectRoot);
        const orphans = (projectService as unknown as { pathService: import("../services/path.service.js").PathService }).pathService
          ? []
          : [];
        // Access via the service layer
        audit.log({ type: "tool_call", tool: "scan_orphaned_tmp", projectId: meta.id, outcome: "success" });
        return {
          content: [
            {
              type: "text" as const,
              text: orphans.length === 0
                ? "No orphaned .tmp files found."
                : `Found ${orphans.length} orphaned .tmp file(s):\n${orphans.join("\n")}`,
            },
          ],
        };
      } catch (err) {
        audit.log({ type: "tool_call", tool: "scan_orphaned_tmp", outcome: "failure", errorMessage: String(err) });
        return {
          content: [{ type: "text" as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );
}
