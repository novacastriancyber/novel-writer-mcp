# Backup and Restore Guide

## What to back up

Your novel projects live inside your configured `approvedRoots`. By default on Windows:

```
C:\Users\YourName\Documents\novels\
  my-novel\
    project.json
    memory.json
    planning.json
    drafts\
    exports\
    reports\
    logs\
```

**Minimum backup:** `project.json`, `memory.json`, `planning.json`, and the `drafts/` folder contain everything needed to restore your work. Export files and reports can be regenerated.

**Full backup:** back up the entire project folder, including `exports/` and `logs/`, to preserve your export history and audit trail.

---

## Manual backup (Windows)

### Robocopy (recommended for incremental backups)

```powershell
# Mirror novels folder to an external drive or NAS
robocopy "C:\Users\YourName\Documents\novels" "D:\Backups\novels" /MIR /R:3 /W:5 /LOG:"D:\Backups\novels-backup.log"
```

`/MIR` mirrors the source (adds new files, removes files deleted from source). Remove `/MIR` if you want a one-way copy that never deletes from backup.

### Scheduled daily backup (Task Scheduler)

1. Open Task Scheduler → Create Basic Task.
2. Name: `Novel Writer Backup`.
3. Trigger: Daily, at a time you choose.
4. Action: Start a program.
   - Program: `robocopy`
   - Arguments: `"C:\Users\YourName\Documents\novels" "D:\Backups\novels" /MIR /R:3 /W:5`
5. Finish and enable the task.

---

## Cloud backup

### OneDrive (built into Windows 11)

Move your novels folder into OneDrive:

```powershell
# Move folder
Move-Item "C:\Users\YourName\Documents\novels" "C:\Users\YourName\OneDrive\novels"
```

Then update `novel-writer.config.json`:

```json
{
  "approvedRoots": ["C:/Users/YourName/OneDrive/novels"]
}
```

OneDrive syncs continuously. Files in OneDrive also have version history (up to 30 days on most plans).

### rclone (NAS, Backblaze B2, Dropbox, etc.)

```powershell
# Install rclone from rclone.org, configure a remote, then:
rclone sync "C:\Users\YourName\Documents\novels" "myremote:novels-backup" --progress
```

---

## Git-based versioning (optional, advanced)

For full version history of your manuscript:

```powershell
cd "C:\Users\YourName\Documents\novels\my-novel"
git init
# Add a .gitignore to exclude logs and exports if desired:
"logs/`nexports/`nreports/" | Out-File .gitignore -Encoding utf8
git add .
git commit -m "Initial commit"
```

Commit after each writing session. Push to a private GitHub/Gitea repo for off-site backup.

---

## Restoring from backup

### Full restore

```powershell
# Copy backup back to novels folder
robocopy "D:\Backups\novels" "C:\Users\YourName\Documents\novels" /MIR /R:3 /W:5
```

### Restore a single project

```powershell
# Copy just the project folder
Copy-Item -Recurse "D:\Backups\novels\my-novel" "C:\Users\YourName\Documents\novels\my-novel" -Force
```

### Restore a single file (memory or planning)

```powershell
# Restore memory.json from backup
Copy-Item "D:\Backups\novels\my-novel\memory.json" "C:\Users\YourName\Documents\novels\my-novel\memory.json" -Force
```

---

## Recovering from a crashed write

The server uses **atomic writes** — all files are written to a `.tmp` file first, then renamed. If the server crashed mid-write, you may find orphaned `.tmp` files.

On the next server startup, the server scans for orphaned `.tmp` files and logs a warning. To clean them up manually:

```powershell
# Find orphaned .tmp files
Get-ChildItem "C:\Users\YourName\Documents\novels" -Recurse -Filter "*.tmp"

# Delete them (inspect first to confirm they are stale)
Get-ChildItem "C:\Users\YourName\Documents\novels" -Recurse -Filter "*.tmp" | Remove-Item
```

The corresponding non-`.tmp` file (without the `.tmp` extension) will still contain the last successfully written version.

---

## Backup checklist

Before a major revision session:

- [ ] Copy project folder to a dated backup folder (`my-novel-2026-06-25/`)
- [ ] Or commit to git: `git add -A && git commit -m "Before chapter 12 rewrite"`
- [ ] Verify `memory.json` and `planning.json` are readable (open in a text editor and check for valid JSON)

After exporting:

- [ ] Confirm the exported file exists and is non-zero size
- [ ] Copy the export to your backup location
- [ ] Check the manifest JSON for the correct chapter count and word count

---

## What the server never backs up automatically

The server does not run scheduled backups itself. All backup automation is external (robocopy, OneDrive, rclone, git). The server only:

- Writes files atomically (crash-safe)
- Retains chapter versions (each `saveChapterVersion` creates a new numbered file — old versions are not deleted)
- Retains audit logs (JSONL, one file per day, purged after `logRetentionDays`)

Chapter versions accumulate in `drafts/chapters/` — these are your built-in version history for draft text.
