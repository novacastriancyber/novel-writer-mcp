import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs";
import path from "node:path";
import { ProjectService } from "../services/project.service.js";
import { AuditService } from "../services/audit.service.js";

export function registerResources(
  server: McpServer,
  projectService: ProjectService,
  audit: AuditService
): void {

  // ── novel://project/{projectRoot}/metadata ─────────────────────────────────
  server.resource(
    "project-metadata",
    new ResourceTemplate("novel://project/{projectRoot}/metadata", { list: undefined }),
    async (uri, { projectRoot }) => {
      const root = decodeURIComponent(projectRoot as string);
      try {
        const meta = projectService.load(root);
        audit.log({ type: "resource_read", resource: uri.toString(), projectId: meta.id, outcome: "success" });
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: "application/json",
              text: JSON.stringify(meta, null, 2),
            },
          ],
        };
      } catch (err) {
        audit.log({ type: "resource_read", resource: uri.toString(), outcome: "failure", errorMessage: String(err) });
        throw err;
      }
    }
  );

  // ── novel://project/{projectRoot}/outline ──────────────────────────────────
  server.resource(
    "project-outline",
    new ResourceTemplate("novel://project/{projectRoot}/outline", { list: undefined }),
    async (uri, { projectRoot }) => {
      const root = decodeURIComponent(projectRoot as string);
      const outlineDir = path.join(root, "outline");
      try {
        const files = fs.existsSync(outlineDir) ? fs.readdirSync(outlineDir) : [];
        const latestFile = files
          .filter((f) => f.endsWith(".md") || f.endsWith(".json"))
          .sort()
          .at(-1);
        const text = latestFile
          ? fs.readFileSync(path.join(outlineDir, latestFile), "utf-8")
          : "(no outline created yet)";
        audit.log({ type: "resource_read", resource: uri.toString(), outcome: "success" });
        return {
          contents: [{ uri: uri.toString(), mimeType: "text/plain", text }],
        };
      } catch (err) {
        audit.log({ type: "resource_read", resource: uri.toString(), outcome: "failure", errorMessage: String(err) });
        throw err;
      }
    }
  );

  // ── novel://project/{projectRoot}/characters ───────────────────────────────
  server.resource(
    "project-characters",
    new ResourceTemplate("novel://project/{projectRoot}/characters", { list: undefined }),
    async (uri, { projectRoot }) => {
      const root = decodeURIComponent(projectRoot as string);
      const charDir = path.join(root, "characters");
      try {
        const files = fs.existsSync(charDir) ? fs.readdirSync(charDir) : [];
        const entries = files
          .filter((f) => f.endsWith(".json"))
          .map((f) => {
            try {
              return JSON.parse(fs.readFileSync(path.join(charDir, f), "utf-8")) as unknown;
            } catch {
              return { file: f, error: "parse error" };
            }
          });
        audit.log({ type: "resource_read", resource: uri.toString(), outcome: "success" });
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: "application/json",
              text: JSON.stringify(entries, null, 2),
            },
          ],
        };
      } catch (err) {
        audit.log({ type: "resource_read", resource: uri.toString(), outcome: "failure", errorMessage: String(err) });
        throw err;
      }
    }
  );

  // ── novel://project/{projectRoot}/continuity ───────────────────────────────
  server.resource(
    "project-continuity",
    new ResourceTemplate("novel://project/{projectRoot}/continuity", { list: undefined }),
    async (uri, { projectRoot }) => {
      const root = decodeURIComponent(projectRoot as string);
      const contDir = path.join(root, "continuity");
      try {
        const files = fs.existsSync(contDir) ? fs.readdirSync(contDir) : [];
        const latest = files.filter((f) => f.endsWith(".json")).sort().at(-1);
        const text = latest
          ? fs.readFileSync(path.join(contDir, latest), "utf-8")
          : JSON.stringify({ issues: [], lastChecked: null }, null, 2);
        audit.log({ type: "resource_read", resource: uri.toString(), outcome: "success" });
        return {
          contents: [{ uri: uri.toString(), mimeType: "application/json", text }],
        };
      } catch (err) {
        audit.log({ type: "resource_read", resource: uri.toString(), outcome: "failure", errorMessage: String(err) });
        throw err;
      }
    }
  );

  // ── novel://project/{projectRoot}/style ────────────────────────────────────
  server.resource(
    "project-style",
    new ResourceTemplate("novel://project/{projectRoot}/style", { list: undefined }),
    async (uri, { projectRoot }) => {
      const root = decodeURIComponent(projectRoot as string);
      const styleDir = path.join(root, "style");
      try {
        const files = fs.existsSync(styleDir) ? fs.readdirSync(styleDir) : [];
        const latest = files.filter((f) => f.endsWith(".json")).sort().at(-1);
        const text = latest
          ? fs.readFileSync(path.join(styleDir, latest), "utf-8")
          : JSON.stringify({ profiles: [], doNotUseList: [] }, null, 2);
        audit.log({ type: "resource_read", resource: uri.toString(), outcome: "success" });
        return {
          contents: [{ uri: uri.toString(), mimeType: "application/json", text }],
        };
      } catch (err) {
        audit.log({ type: "resource_read", resource: uri.toString(), outcome: "failure", errorMessage: String(err) });
        throw err;
      }
    }
  );

  // ── novel://server/config ──────────────────────────────────────────────────
  server.resource(
    "server-config",
    "novel://server/config",
    async (uri) => {
      audit.log({ type: "resource_read", resource: uri.toString(), outcome: "success" });
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: "(server config summary — API keys redacted)",
          },
        ],
      };
    }
  );
}
