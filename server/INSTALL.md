# MCP Novel Writer — Installation

## Prerequisites

- Node.js 20 or later
- Windows 11 (local homelab deployment)

## Build

```powershell
cd C:\Projects\mcp-novel\server
npm install
npm run build
```

## Configuration

Copy `novel-writer.config.example.json` to `novel-writer.config.json` in the same folder, then edit:

- Set `approvedRoots` to one or more absolute paths where novel projects may be created.
- Optionally configure `llamacpp` endpoint and `openrouterApiKeyEnv`.

The server reads `novel-writer.config.json` from its working directory by default, or from the path in the `NOVEL_CONFIG_PATH` environment variable.

## Claude Desktop integration

Add to `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "novel-writer": {
      "command": "node",
      "args": ["C:\\Projects\\mcp-novel\\server\\dist\\index.js"],
      "env": {
        "NOVEL_CONFIG_PATH": "C:\\Projects\\mcp-novel\\server\\novel-writer.config.json"
      }
    }
  }
}
```

## Claude Code integration

Run from the project root:

```powershell
claude mcp add novel-writer node C:\Projects\mcp-novel\server\dist\index.js --env NOVEL_CONFIG_PATH=C:\Projects\mcp-novel\server\novel-writer.config.json
```

## Running tests

```powershell
npm test
```
