# MCP Novel Writer — User Manual

This manual covers how to use the novel writer MCP server with Claude Desktop to write long-form fiction. It assumes the server is already installed and connected — see [INSTALL.md](INSTALL.md) if not.

---

## How this works

The MCP server gives Claude a set of tools for structured fiction writing. Claude acts as your creative partner and reasoning engine; the server handles persistent storage, file safety, and consistency checking.

**You talk to Claude. Claude uses the tools.** You never call tools directly. You just tell Claude what you want — "Start a new novel about a detective in 1920s Cairo" — and Claude calls the appropriate tools, reads the results, and responds to you with the output.

All your novel files are stored locally in your configured novels folder. Nothing is sent to a cloud service unless you explicitly configure model routing.

---

## Part 1 — Starting a project

### Create your novel project

Tell Claude something like:

> "Create a new novel project called 'The Clockwork Pharaoh'. It's a historical mystery set in 1920s Cairo, third-person limited POV, past tense, targeting 80,000 words."

Claude will call `create_novel_project` and set up the project folder with your settings. It will give you back a `projectRoot` path — this is what identifies your project in all future conversations.

**Settings you can specify at creation:**
- Working title
- Genre(s) with weights (e.g. `historical-mystery 0.7, thriller 0.3`)
- Target word count
- Content rating (`G`, `PG`, `PG-13`, `R`)
- Structure model (`three-act`, `hero's-journey`, `save-the-cat`, `five-act`, `episodic`)
- Point of view (`first-person`, `third-limited`, `third-omniscient`, `second`)
- Tense (`past`, `present`)
- Setting
- Do-not-use word list

You can change most of these later. The `projectRoot` path is fixed.

### List your projects

> "Show me all my novel projects."

Claude will call `list_novel_projects` and return all projects found in your approved roots.

---

## Part 2 — Building your world

### Save characters

> "Add a character: Samir al-Rashid, 42-year-old Egyptian police inspector, speaks French and Arabic, morally pragmatic, has a prosthetic left hand from a war injury. He's the protagonist."

Claude will call `save_character` and store this in your project's memory. Good character records include:
- Name and aliases (nicknames, titles)
- Physical description
- Personality traits
- Role in the story
- Backstory and secrets
- Relationships to other characters

You can update a character at any time:

> "Add to Samir's character: he has a complicated relationship with the British occupation — professionally cooperative, privately resentful."

### Save world notes

> "Add a world note: the story is set in Cairo in 1923. The city is under British influence via the Protectorate, but nominally independent. The Antiquities Service is run by Pierre Lacau, a French Egyptologist."

Claude calls `save_world_note`. Use world notes for historical facts, locations, rules of your world, or anything that needs to stay consistent across chapters.

### Save continuity facts

> "Record as a continuity fact: Samir's wife Layla died in 1918 during the influenza pandemic. He does not speak of her."

Claude calls `save_continuity_fact`. These are specific facts that must not be contradicted later — dates, deaths, character secrets, established timeline events.

---

## Part 3 — Planning your novel

### Create a structure plan

> "Let's outline the three-act structure for The Clockwork Pharaoh. Act 1 ends with Samir finding the body in the tomb. Act 2 escalates through the rival factions — the British archaeologist, the Cairo smuggling ring, and the nationalist movement. Act 3 begins when Samir realizes the crime connects to a forgery network inside the Antiquities Service."

Claude will call `save_structure_plan` with this outline. You can be as detailed or as loose as you like — it's your working plan, not a contract.

### Save scene briefs

Before writing each chapter, brief Claude on what needs to happen:

> "Create a scene brief for Chapter 1: Samir is called to the Valley of the Kings. He arrives to find the British archaeologist Lord Ashford dead inside a newly opened tomb. The cause of death appears to be a fall, but Samir notices the man's pocket watch has been stopped deliberately. Introduce Ashford's assistant, Miss Helena Cross. Tone: atmospheric, slow-burn. Target 3,500 words."

Claude calls `save_scene_brief`. The brief lives in your project planning and is available when you're ready to draft.

### Define your genre contract

> "Set up the genre contract: this is a historical mystery. The reader expects a fair-play mystery where all clues are available, a satisfying resolution, historical accuracy in detail, and a morally complex detective who plays by his own rules. Promise: the murder will be solved. Promise: the killer will be named in the final act."

Claude calls `save_genre_contract`. This is used by the continuity checker to flag if your draft is drifting from reader expectations.

### Set a style guide

> "My style guide: spare prose, no adverbs on dialogue tags ('she said' not 'she said quietly'). Short paragraphs for tension, longer for description. Cairo sensory details — heat, dust, spices, Arabic music — in every scene. Do not use: utilize, leverage, impactful, very."

Claude calls `save_style_guide`. The style consistency checker uses this when reviewing your drafts.

---

## Part 4 — Drafting

### Assemble context before writing

Before asking Claude to write a chapter, have it assemble the full context:

> "Assemble the draft context for Chapter 3."

Claude calls `assemble_draft_context`, which pulls together:
- Your project settings
- All characters
- World notes and continuity facts
- The structure plan and scene brief for this chapter
- The previous chapter's draft (for continuity of voice and events)
- Any open plot threads

With all this loaded, Claude is ready to write with full awareness of your project.

### Write the chapter

> "Now write Chapter 3 based on the brief. Match the established voice from Chapter 2. Take your time with the tomb discovery — let the atmosphere build."

Claude writes the chapter as prose in the conversation. When you're happy with a section, save it:

> "Save this as Chapter 3, version 1."

Claude calls `save_draft` and stores the text as a versioned file. Every save creates a new numbered version — nothing is ever overwritten.

### Revise and save new versions

> "The ending of Chapter 3 feels rushed. Rewrite the final scene — from where Helena discovers the stopped watch — to slow down and add more of Samir's internal reaction."

Claude rewrites the passage. When satisfied:

> "Save this as a new version of Chapter 3."

Claude increments the version. You can always go back to earlier versions.

### Compare versions

> "Show me what changed between Chapter 3 version 1 and version 2."

Claude calls `compare_versions` and returns a structured diff with word count change and a summary of differences.

### Track word count progress

> "How are we doing on word count? I'm targeting 80,000 words."

Claude calls `word_count_progress` and returns totals per chapter and your overall progress toward the target.

### Expansion and condensation prompts

If a chapter is running short:

> "Chapter 5 is only 2,100 words but the brief called for 3,500. Build me an expansion prompt."

Claude calls `build_expansion_prompt` and returns a structured prompt you can use to ask Claude to deepen the chapter — more sensory detail, inner monologue, scene texture.

If a chapter is too long:

> "Chapter 8 is 6,200 words — it's dragging. Build a condensation prompt."

Claude calls `build_condensation_prompt` with guidance for tightening without losing substance.

---

## Part 5 — Revision passes

Revision passes let you run structured editorial sweeps across the manuscript and track what was reviewed and approved.

### Start a revision pass

> "Start a line-edit pass for Chapter 4. Focus: cut adverbs, tighten dialogue tags, sharpen the confrontation scene."

Claude calls `save_revision_pass` and creates a tracked revision record for this chapter and pass type.

### Complete and approve

> "The line edit on Chapter 4 is done. Mark it complete and approved."

Claude calls `complete_revision_pass` and then `approve_revision_pass`. Approved passes are recorded in the project and show up in export readiness reports.

**Pass types available:**
- `line-edit` — sentence-level prose polish
- `structural` — scene order, pacing, act structure
- `character-voice` — consistency of how each character speaks and thinks
- `continuity` — facts, timeline, physical descriptions
- `final-proof` — last pass before export

---

## Part 6 — Continuity and readiness checking

### Run a full continuity check

> "Run a continuity check on the whole manuscript so far."

Claude calls `check_continuity`, which looks for:
- Duplicate character names or conflicting aliases
- Open plot threads with no assigned chapter
- Characters referenced in open threads who have been archived
- Repeated continuity facts (possible contradictions)
- Missing chapter drafts (chapter brief exists but no draft)

It returns a report with **blocking** issues (must fix before export), **warnings** (should review), and **notes** (minor observations).

### Check readiness before writing a chapter

> "Am I ready to start Chapter 6? Are there any unresolved issues that would affect it?"

Claude calls `check_chapter_readiness`, which checks continuity and confirms the chapter has a brief and the previous chapter is drafted. If blocking issues exist, you can override:

> "Override and proceed anyway — I'll fix the continuity issue after drafting."

### Check style consistency

> "Check Chapter 5 for style guide violations."

Claude calls `check_style_consistency`, which scans for:
- Words on your do-not-use list
- Tense drift (mixing past and present)
- POV slips (e.g. suddenly knowing another character's thoughts in third-limited)

### Check genre contract

> "Check whether the manuscript is meeting the expectations for historical mystery."

Claude calls `check_genre_contract`, which reviews your draft text against your genre promises and reader expectations.

### Check pacing

> "How is the pacing across the chapters so far? Are any chapters too slow?"

Claude calls `check_pacing` and returns per-chapter metrics: word count, dialogue ratio, paragraph length, and a pacing label (fast / moderate / slow). It flags outliers — chapters that are more than twice the average length, or three consecutive slow chapters.

---

## Part 7 — Import

### Import research documents

> "Import this PDF of a 1923 Cairo guidebook as research. It's factual, not mine."

Claude calls `import_research`. The document is stored and flagged as factual reference material (not usable as prose). You can then ask Claude to synthesise from it:

> "From the Cairo guidebook, what details about the Khan el-Khalili bazaar would be period-accurate for a scene set in 1923?"

### Import existing writing

> "I have a chapter I drafted in Word. Here's the text. Import it as Chapter 2, version 1."

Paste the text and Claude calls `import_document` to store it as a versioned chapter draft in the project.

---

## Part 8 — Export

### Check export readiness

> "Is the manuscript ready to export?"

Claude calls `check_export_readiness`, which returns:
- **Blockers** — must fix (e.g. no chapters exist)
- **Warnings** — should review (e.g. no chapters are approved, word count under 80% of target, open plot threads)
- Total word count, drafted chapters, approved chapters

### Preview the manuscript

> "Show me the full manuscript compiled in order."

Claude calls `build_manuscript` and returns the chapters assembled in numeric order with a title page. The first 2,000 characters are shown in the response; the full text is written when you export.

### Export to a format

> "Export the manuscript to a Word document with a title page and my dedication: 'For Layla.'"

Claude calls `export_manuscript` with format `docx`. The file is saved to the `exports/` folder inside your project and a manifest is returned with the output path, word count, and chapter list.

**Available formats:**

| Format | Use case |
|--------|----------|
| `markdown` | Plain text, portable, version-control friendly |
| `html` | Web preview, shareable as a single file |
| `docx` | Submission to agents/publishers, editing in Word |
| `epub` | Ebook readers, Kindle (via Calibre) |
| `pdf` | Print-ready; opens HTML source — print to PDF in browser or use `pandoc` |

### Export with front and back matter

> "Export to EPUB. Include a title page, table of contents, dedication 'For everyone who almost quit', and an author note explaining the historical context."

Front matter options: `titlePage`, `tableOfContents`, `dedication`, `acknowledgements`, `authorNote`

Back matter options: `aboutAuthor`, `glossary`, `acknowledgements`

### Export selected chapters

> "Export just chapters 1 through 5 to markdown — I want to send this excerpt to a beta reader."

Claude passes `chapterNumbers: [1, 2, 3, 4, 5]` to `export_manuscript`.

### List export history

> "Show me all my previous exports."

Claude calls `list_export_manifests`, which returns all export records newest-first with format, file path, word count, and export date.

---

## Part 9 — Model routing (optional)

By default, all tasks use the `host` provider — meaning Claude (the model you're talking to) does all the work. This is the recommended setting.

If you have llama.cpp or OpenRouter configured, you can route specific low-stakes tasks to a local or cloud model:

> "What's the current model routing configuration?"

Claude calls `get_server_config` and returns the current policy (without exposing API keys).

> "Update model routing: use the host for drafting and revision, use openrouter for research and summary tasks."

Claude calls `update_model_policy`. Cloud tasks (`draft`, `revision`, `outline`, `research`) require explicit `authorApproved: true` before a route to a cloud provider is accepted.

> "Test the llama.cpp connection."

Claude calls `test_model_route` for llamacpp and returns latency or an error.

> "How would chapter research be routed right now?"

Claude calls `resolve_model_route` for the `research` task and tells you which provider would handle it and whether cloud approval is required.

---

## Part 10 — Recommended workflows

### Starting a novel from scratch

1. Create the project with your settings
2. Save all major characters
3. Save world notes (setting, rules, historical context)
4. Create the structure plan
5. Save scene briefs for Act 1 chapters
6. Set your genre contract and style guide
7. Assemble draft context → write Chapter 1 → save draft
8. Run continuity check after every 3–4 chapters
9. Run style consistency check before revision passes
10. Export draft to markdown after completing each act

### Session startup (returning to an existing project)

Start each writing session by asking Claude:

> "Load the memory and planning for The Clockwork Pharaoh and give me a status summary — where we are, what's next, and any open continuity issues."

Claude will call `load_project_memory` and `check_continuity` and give you a concise briefing before you dive in.

### Before sending to a beta reader

1. Run `check_continuity` — fix all blocking issues
2. Run `check_style_consistency` on each chapter
3. Run `check_genre_contract`
4. Run `check_pacing` — review any chapters flagged as slow
5. Run `check_export_readiness` — confirm no blockers
6. Export to `docx` or `epub`
7. Check the manifest confirms the correct chapter count and word count

### Chapter writing routine

1. `check_chapter_readiness` — confirm you're clear to start
2. `assemble_draft_context` — load everything relevant
3. Write the chapter in conversation
4. `save_draft` — version 1
5. Read it back, request revisions
6. `save_draft` — version 2 (or more)
7. `check_style_consistency` on the new chapter
8. `save_revision_pass` + `complete_revision_pass` + `approve_revision_pass`

---

## Tips and best practices

**Keep projectRoot handy.** The project root path (e.g. `C:\Users\YourName\Documents\novels\the-clockwork-pharaoh`) is how all tools identify your project. At the start of a session, tell Claude which project you're working on by name or path.

**Save early, save often.** Call `save_draft` whenever you have a version you want to keep. Versions accumulate — nothing is deleted.

**Continuity facts are a contract.** Anything you save as a continuity fact will be checked against later. Only save things that must be true — not maybes or possibilities.

**Scene briefs are pre-flight.** Write the brief before the chapter, not after. It forces clarity about what the chapter must accomplish and gives Claude a concrete target.

**Use revision passes formally.** Don't just re-draft casually — save a named revision pass, complete it, and approve it. This creates a paper trail and makes export readiness reports meaningful.

**Export often, export to markdown.** Markdown exports are instant and the file is human-readable. Export after each session as a cheap backup of where you are.

**The pacing check is a diagnostic, not a verdict.** A "slow" chapter isn't necessarily bad — a reflective character chapter should be slow. Use it to notice unintended patterns, not to chase arbitrary metrics.

**Don't fight the do-not-use list.** If you're tempted to use a word on the list, it means either the list is wrong (remove the word) or your sentence needs rethinking. The list exists to protect your voice, not restrict it.

---

## Quick reference — all tools

| Tool | What to ask Claude |
|------|--------------------|
| `create_novel_project` | "Start a new novel project called..." |
| `list_novel_projects` | "Show me all my novel projects" |
| `validate_project` | "Validate the project structure" |
| `archive_project` | "Archive this project as a zip" |
| `save_character` | "Add/update a character: ..." |
| `save_world_note` | "Add a world note: ..." |
| `save_continuity_fact` | "Record as a continuity fact: ..." |
| `save_chapter_version` | "Save this as Chapter N version X" |
| `load_project_memory` | "Load the memory for this project" |
| `save_structure_plan` | "Here's the structure plan: ..." |
| `save_scene_brief` | "Create a scene brief for Chapter N: ..." |
| `save_genre_contract` | "Set the genre contract: ..." |
| `save_style_guide` | "My style guide: ..." |
| `import_document` | "Import this text as Chapter N" |
| `import_research` | "Import this as research material" |
| `assemble_draft_context` | "Assemble the draft context for Chapter N" |
| `save_draft` | "Save this draft" |
| `compare_versions` | "Compare Chapter N version X and Y" |
| `word_count_progress` | "How are we doing on word count?" |
| `save_revision_pass` | "Start a line-edit pass for Chapter N" |
| `approve_revision_pass` | "Approve the revision pass for Chapter N" |
| `build_expansion_prompt` | "Chapter N is too short — build an expansion prompt" |
| `build_condensation_prompt` | "Chapter N is too long — build a condensation prompt" |
| `check_continuity` | "Run a continuity check" |
| `check_chapter_readiness` | "Am I ready to start Chapter N?" |
| `check_style_consistency` | "Check Chapter N for style violations" |
| `check_genre_contract` | "Check whether we're meeting genre expectations" |
| `check_pacing` | "How is the pacing across the manuscript?" |
| `check_export_readiness` | "Is the manuscript ready to export?" |
| `build_manuscript` | "Show me the compiled manuscript" |
| `export_manuscript` | "Export to [markdown / docx / epub / html / pdf]" |
| `list_export_manifests` | "Show me all previous exports" |
| `get_server_config` | "What's the model routing configuration?" |
| `update_model_policy` | "Route research tasks to openrouter" |
| `test_model_route` | "Test the llama.cpp connection" |
| `resolve_model_route` | "How would drafting be routed?" |
| `list_route_audits` | "Show the route audit log" |
