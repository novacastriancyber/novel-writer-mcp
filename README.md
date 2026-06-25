# MCP Novel Writer

An aid to help people write their first novel, novella, and beyond.

A TypeScript MCP (Model Context Protocol) server for long-form fiction creation. The server runs alongside Claude Desktop and gives Claude structured, file-backed tools for every stage of the novel-writing process — from project setup through drafting, continuity checking, and final export.

## Architecture

**Host-led mode.** The server provides context and persistent storage. Claude is the reasoning engine — it reads memory, plans, drafts, and continuity reports, then uses them to write. The server never calls an LLM directly unless you configure an optional local or cloud model route.

All novel project files are stored under your approved roots (configured at startup). Nothing is sent outside your machine unless you explicitly enable OpenRouter or llama.cpp routing.

## Features

| Phase | Tools |
|-------|-------|
| **Project management** | `create_novel_project`, `list_novel_projects`, `validate_project`, `archive_project` |
| **Memory** | `save_character`, `save_chapter_version`, `save_continuity_fact`, `save_world_note`, `load_project_memory` |
| **Planning** | `save_structure_plan`, `save_scene_brief`, `save_genre_contract`, `save_style_guide` |
| **Import** | `import_document`, `import_research`, `list_imports` |
| **Drafting** | `assemble_draft_context`, `save_draft`, `compare_versions`, `word_count_progress`, `save_revision_pass`, `approve_revision_pass`, `build_expansion_prompt`, `build_condensation_prompt` |
| **Continuity** | `check_continuity`, `check_chapter_readiness`, `check_style_consistency`, `check_genre_contract`, `check_pacing` |
| **Model routing** | `get_server_config`, `update_model_policy`, `test_model_route`, `resolve_model_route`, `list_route_audits` |
| **Export** | `check_export_readiness`, `build_manuscript`, `export_manuscript`, `list_export_manifests` |

**Export formats:** Markdown, HTML, DOCX (Word), EPUB (ebook), PDF source (for browser print-to-PDF or pandoc).

## Quick start

See [docs/INSTALL.md](docs/INSTALL.md) for full installation instructions on Windows 11 and homelab deployment.

```bash
cd server
npm install
npm run build
```

Configure `novel-writer.config.json` in the server directory or point `NOVEL_CONFIG_PATH` to a config file:

```json
{
  "approvedRoots": ["C:/Users/YourName/Documents/novels"],
  "logRetentionDays": 30,
  "defaultModelRoutes": [
    { "task": "draft", "provider": "host" },
    { "task": "revision", "provider": "host" }
  ],
  "openrouterApiKeyEnv": "OPENROUTER_API_KEY"
}
```

Then add to Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "novel-writer": {
      "command": "node",
      "args": ["C:/Projects/mcp-novel/server/dist/index.js"]
    }
  }
}
```

## Project file layout

Each novel project is a folder inside one of your approved roots:

```
novels/
  my-novel/
    project.json          # Project metadata and settings
    memory.json           # Characters, world notes, chapter versions, continuity facts
    planning.json         # Structure plan, scene briefs, genre contract, style guide
    drafts/
      draft-session.json  # Active draft session and revision passes
    exports/              # Generated manuscript files and manifests
    reports/              # Continuity, pacing, and readiness reports
    logs/                 # Audit logs (JSONL, one file per day)
```

## Safety guarantees

- All file writes are atomic (write to `.tmp`, validate, rename).
- Path traversal is rejected at the service layer — all resolved paths must be inside an approved root.
- API keys are never written to export files, manifests, or audit logs.
- The `getSafeConfig` tool returns a boolean `openrouterConfigured`, never the key value.
- Deleted files are never silently overwritten — versioning is used throughout.

## Tests

```bash
npm test
```

143 tests across 13 suites covering all services, path safety, secret redaction, and an end-to-end workflow integration test.

## License

MIT
