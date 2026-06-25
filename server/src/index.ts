import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { ConfigService } from "./services/config.service.js";
import { AuditService } from "./services/audit.service.js";
import { PathService } from "./services/path.service.js";
import { ProjectService } from "./services/project.service.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { MemoryService } from "./services/memory.service.js";
import { registerMemoryTools } from "./tools/memory.tools.js";
import { PlanningService } from "./services/planning.service.js";
import { registerPlanningTools } from "./tools/planning.tools.js";
import { ImportService } from "./services/import.service.js";
import { registerImportTools } from "./tools/import.tools.js";
import { DraftingService } from "./services/drafting.service.js";
import { registerDraftingTools } from "./tools/drafting.tools.js";
import { ContinuityService } from "./services/continuity.service.js";
import { registerContinuityTools } from "./tools/continuity.tools.js";
import { RoutingService } from "./services/routing.service.js";
import { registerRoutingTools } from "./tools/routing.tools.js";
import { ExportService } from "./services/export.service.js";
import { registerExportTools } from "./tools/export.tools.js";

async function main(): Promise<void> {
  // ── 1. Load and validate configuration ──────────────────────────────────
  const configService = new ConfigService();
  const config = configService.get();

  // ── 2. Initialise audit service ─────────────────────────────────────────
  const logDir = config.approvedRoots[0]
    ? path.join(config.approvedRoots[0], ".novel-writer", "logs")
    : path.join(process.cwd(), "logs");

  const audit = new AuditService(logDir, config.logRetentionDays);
  audit.log({ type: "config_load", outcome: "success", details: { configPath: process.env["NOVEL_CONFIG_PATH"] ?? "default" } });

  // ── 3. Scan for orphaned .tmp files ─────────────────────────────────────
  const pathService = new PathService(config.approvedRoots);
  for (const root of config.approvedRoots) {
    const orphans = pathService.findOrphanedTmp(root);
    if (orphans.length > 0) {
      audit.log({
        type: "file_read",
        outcome: "failure",
        errorMessage: `Found ${orphans.length} orphaned .tmp file(s) in ${root}`,
        details: { orphans },
      });
      process.stderr.write(
        `[mcp-novel] WARNING: ${orphans.length} orphaned .tmp file(s) found in ${root}. ` +
        `Review and remove: ${orphans.join(", ")}\n`
      );
    }
  }

  // ── 4. Build services ────────────────────────────────────────────────────
  const projectService = new ProjectService(pathService, audit);
  const memoryService = new MemoryService(pathService, audit);
  const planningService = new PlanningService(pathService, audit);
  const importService = new ImportService(pathService, audit, memoryService);
  const draftingService = new DraftingService(pathService, audit, memoryService, planningService);
  const continuityService = new ContinuityService(pathService, audit, memoryService, planningService);
  const routingService = new RoutingService(pathService, audit, configService);
  const exportService = new ExportService(pathService, audit, memoryService, planningService, projectService);

  // ── 5. Build MCP server ──────────────────────────────────────────────────
  const server = new McpServer({
    name: "mcp-novel-writer",
    version: "0.9.0",
  });

  registerTools(server, projectService, audit, config);
  registerMemoryTools(server, memoryService, projectService, audit);
  registerPlanningTools(server, planningService, audit);
  registerImportTools(server, importService, audit);
  registerDraftingTools(server, draftingService, projectService, audit);
  registerContinuityTools(server, continuityService, audit);
  registerRoutingTools(server, routingService, audit, logDir);
  registerExportTools(server, exportService, audit);
  registerResources(server, projectService, audit);
  registerPrompts(server, audit);

  // ── 6. Connect stdio transport ───────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("[mcp-novel] Server running on stdio transport.\n");

  // Purge old audit logs on startup (non-blocking)
  setImmediate(() => audit.purgeOldLogs());
}

main().catch((err) => {
  process.stderr.write(`[mcp-novel] Fatal error: ${String(err)}\n`);
  process.exit(1);
});
