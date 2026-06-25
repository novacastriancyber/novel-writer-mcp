# Installation Guide — Windows 11 and Homelab Deployment

## Requirements

| Dependency | Minimum version | Notes |
|------------|-----------------|-------|
| Node.js | 20.x LTS | Required. Download from nodejs.org |
| Claude Desktop | Latest | Required for MCP integration |
| npm | 10.x | Bundled with Node |
| Git | Any | Recommended for version control |

Optional:
- **pandoc** — required only to convert PDF source HTML to a true PDF (`pandoc input.html -o output.pdf`)
- **llama.cpp server** — required only if you configure the `llamacpp` model route

---

## Step 1 — Install Node.js

1. Download the Node.js 20 LTS installer from [nodejs.org](https://nodejs.org).
2. Run the installer with default settings.
3. Verify: open PowerShell and run `node --version`. You should see `v20.x.x` or later.

---

## Step 2 — Clone or copy the server

```powershell
# If you have git:
git clone https://github.com//novacastriancyber/mcp-novel-writer.git

# Or extract the zip into C:\Projects\mcp-novel
```

---

## Step 3 — Install dependencies and build

```powershell
cd C:\Projects\mcp-novel\server
npm install
npm run build
```

This compiles TypeScript to `dist/`. You should see no errors.

---

## Step 4 — Create your novels folder

```powershell
mkdir C:\Users\YourName\Documents\novels
```

This is where all novel projects will be stored. You can use any path — just make sure it matches your config.

---

## Step 5 — Create the config file

Create `C:\Projects\mcp-novel\server\novel-writer.config.json`:

```json
{
  "approvedRoots": ["C:/Users/YourName/Documents/novels"],
  "logRetentionDays": 30,
  "defaultModelRoutes": [
    { "task": "draft", "provider": "host" },
    { "task": "revision", "provider": "host" },
    { "task": "outline", "provider": "host" },
    { "task": "continuity", "provider": "host" },
    { "task": "style-check", "provider": "host" },
    { "task": "genre-check", "provider": "host" },
    { "task": "pacing-check", "provider": "host" },
    { "task": "export", "provider": "host" },
    { "task": "research", "provider": "host" },
    { "task": "summary", "provider": "host" }
  ],
  "openrouterApiKeyEnv": "OPENROUTER_API_KEY"
}
```

Use forward slashes in paths even on Windows (Node.js handles both).

---

## Step 6 — Configure Claude Desktop

Find your Claude Desktop config file:

```
%APPDATA%\Claude\claude_desktop_config.json
```

Add the server to the `mcpServers` block:

```json
{
  "mcpServers": {
    "novel-writer": {
      "command": "node",
      "args": ["C:/Projects/mcp-novel/server/dist/index.js"],
      "env": {
        "NOVEL_CONFIG_PATH": "C:/Projects/mcp-novel/server/novel-writer.config.json"
      }
    }
  }
}
```

---

## Step 7 — Verify the connection

1. Restart Claude Desktop.
2. Start a new conversation.
3. Ask Claude: *"List my novel projects"* — it should call `list_novel_projects` and respond with an empty list or any existing projects.

---

## Optional: OpenRouter (cloud LLM routing)

If you want to route specific tasks (e.g. research, outline) to a cloud model:

1. Create an account at [openrouter.ai](https://openrouter.ai) and generate an API key.
2. Add the key to your environment. In your Claude Desktop config `env` block:
   ```json
   "OPENROUTER_API_KEY": "sk-or-v1-your-key-here"
   ```
3. Update the model policy via the `update_model_policy` tool.

The key is never written to any export file, manifest, or audit log — only a boolean `openrouterConfigured` flag is exposed.

---

## Optional: llama.cpp (local LLM routing)

If you have a local llama.cpp server running:

1. Add to your config:
   ```json
   "llamacpp": {
     "url": "http://localhost:8080",
     "modelAlias": "mistral-7b"
   }
   ```
2. Use `test_model_route` to verify the connection.

---

## Homelab deployment (always-on server)

If you want the MCP server always available (not just when Claude Desktop is running), you can run it as a Windows service using NSSM or Task Scheduler. However, Claude Desktop currently requires the process to be started by Claude — so a separate always-on service is only needed for custom MCP clients.

For a homelab running on a separate machine:

1. Copy the built `dist/` folder and `novel-writer.config.json` to the target machine.
2. Ensure Node.js 20 is installed on that machine.
3. Map your novels folder as a network share or use a path local to the homelab machine.
4. In Claude Desktop on your desktop, set the `command` to connect via SSH or a network path.

---

## Upgrading

```powershell
cd C:\Projects\mcp-novel\server
git pull          # if using git
npm install       # pick up any new dependencies
npm run build     # recompile
```

Restart Claude Desktop after upgrading.
