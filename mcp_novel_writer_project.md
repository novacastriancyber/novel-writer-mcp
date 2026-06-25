# MCP Novel Writer Server

Project file for AI development teams

Prepared for: David Gorton  
Date: 2026-06-25  
Version: 1.0  
Status: Requirements and developer handoff  
Primary builders: Codex, Claude Code, then human developers  
Implementation rule for this document: No implementation code is included.

## 1. Executive summary

Build a TypeScript MCP Server for long-form fiction creation. The server shall help an author plan, research, draft, revise, check continuity, and export novels across genres, blended genres, and selected style profiles.

The product target is a local homelab deployment with Windows 11 folder support. Claude Desktop and Claude Code are the first MCP clients. The initial model priority is local llama.cpp, followed by OpenRouter. The server shall support model switching by task, such as local outlining, cloud editing, local continuity checks, and cloud final prose review.

The MCP Server shall expose tools, resources, and prompts. The core server should not depend on one model vendor. A model-router layer shall be optional, configurable, and isolated from the MCP protocol layer.

The system shall manage each novel as a persistent project with a fixed folder structure, project memory, style guide, research library, character bible, world bible, outline, draft chapters, revision history, continuity index, and final manuscript exports.

## 2. Source inputs and decisions

This handoff uses the completed clarification answers supplied in the uploaded `MCP Novel.md` file.

| Area | Decision |
|---|---|
| Output file formats | Markdown and DOCX |
| Document type | Requirements document and developer handoff |
| First builders | Codex, Claude Code, then other developers |
| First MCP clients | Claude Desktop and Claude Code |
| Server language | TypeScript |
| Deployment | Local homelab |
| OS and folders | Windows 11 and local folders |
| Model priority | llama.cpp first, OpenRouter second |
| Model switching | Required per task |
| Workflow | Concept to finished manuscript |
| Genres | All genres through an extensible registry |
| Genre blending | Required |
| Author styles | Up to 5 author or style profiles per project |
| Living-author handling | Convert exact requests into neutral style traits |
| Manuscript length | Author specifies at project start |
| Structure models | Built-in structures plus custom structures |
| Project memory | Persistent per novel |
| Continuity checks | Required before next chapter drafting |
| Research ingestion | PDF, web pages, notes, images, documents |
| Input formats | TXT, Markdown, DOCX, PDF, EPUB, CSV |
| Export formats | Markdown, DOCX, EPUB, PDF, HTML |
| Versioning | Required for drafts, outlines, and rewrites |
| Product scope | Full product from day one |

## 3. Product vision

The project shall provide a structured authoring system for novels, not a simple text generator. The server shall help the author keep creative control while the AI performs repeatable writing-support tasks.

The server shall preserve the author’s decisions across a long project. It shall track what has been planned, what has been written, what has changed, and what still needs resolution.

The intended outcome is a reliable fiction production workflow with clear project state, repeatable outputs, traceable research, structured revision passes, and export-ready manuscript files.

## 4. Primary goals

1. Create full novel projects from either a one-line idea or a detailed premise.
2. Support all major genres through a configurable genre registry.
3. Support genre blending through weighted genre profiles.
4. Support up to 5 author or style profiles per novel.
5. Convert requests for living-author imitation into neutral style traits.
6. Maintain project memory for every novel.
7. Track continuity across characters, places, timelines, objects, clues, relationships, and unresolved plot threads.
8. Warn about continuity issues before drafting the next chapter.
9. Maintain a research library with internal citations for the author.
10. Produce outlines, scenes, chapters, rewrites, checks, and final manuscript exports.
11. Support local llama.cpp first, then OpenRouter.
12. Support model routing by task.
13. Support Windows 11 local folder workflows.
14. Produce Markdown, DOCX, EPUB, PDF, and HTML exports.

## 5. Non-goals

1. This server shall not replace an editor, publisher, lawyer, or copyright adviser.
2. This server shall not provide exact imitation of living authors.
3. This server shall not bypass MCP client consent controls.
4. This server shall not write outside the configured project folder.
5. This server shall not send local manuscript or research content to OpenRouter unless the author has approved the model route for the task.
6. This server shall not treat AI output as final without author approval.

## 6. MCP design basis

MCP provides a standard way for hosts, clients, and servers to share context, expose capabilities, and build integrations. For this project, Claude Desktop and Claude Code are the first hosts. The MCP Server supplies novel-writing capabilities to those clients.

The server shall expose three MCP feature groups:

| MCP feature | Use in this project |
|---|---|
| Tools | Actions such as creating projects, generating outlines, checking continuity, ingesting research, drafting chapters, and exporting manuscripts |
| Resources | Read-only access to project memory, manuscript status, character bible, world bible, research index, style guide, and continuity reports |
| Prompts | Reusable workflows for premise development, outline generation, drafting, revision, scene expansion, continuity review, and export preparation |

Transport strategy:

| Transport | Project role |
|---|---|
| stdio | Primary local integration for Claude Desktop and Claude Code |
| Streamable HTTP | Homelab option for multi-client access, remote LAN access, and future UI integration |

## 7. Recommended architecture

### 7.1 Architecture summary

Use a modular TypeScript service with a protocol layer, project service layer, storage layer, model-router layer, document processing layer, and export layer.

The MCP layer shall stay thin. Business logic belongs in services outside the MCP transport code. This keeps Claude Desktop, Claude Code, and future clients consistent.

### 7.2 Components

| Component | Responsibility |
|---|---|
| MCP transport adapter | stdio first, Streamable HTTP second |
| MCP tool registry | Declares and exposes all writing tools in deterministic order |
| MCP resource registry | Exposes read-only project state and project documents |
| MCP prompt registry | Provides reusable writing and review workflows |
| Project manager | Creates, loads, validates, archives, and lists novel projects |
| Novel memory service | Maintains character, setting, plot, timeline, object, and clue state |
| Genre registry | Stores genre templates, tropes, pacing, reader expectations, and structure defaults |
| Style profile service | Converts selected author/style inputs into project-safe style traits |
| Outline service | Produces premise, synopsis, act outline, chapter outline, and scene outline |
| Drafting service | Generates chapter and scene drafts from approved outlines and memory |
| Revision service | Performs requested rewrite passes and stores versions |
| Continuity service | Checks contradictions and unresolved plot obligations |
| Research service | Ingests, indexes, cites, and separates factual notes from fictional invention |
| Import service | Reads TXT, Markdown, DOCX, PDF, EPUB, and CSV |
| Export service | Exports Markdown, DOCX, EPUB, PDF, and HTML |
| Model router | Routes tasks to llama.cpp or OpenRouter by policy, task, cost, privacy, and context size |
| Audit service | Records tool calls, file operations, model routes, and author approvals |
| Configuration service | Stores paths, model endpoints, API keys, safety settings, and export preferences |

### 7.3 Model-routing recommendation

The server shall support two operating modes.

| Mode | Description | Recommended use |
|---|---|---|
| Host-led mode | Claude client calls MCP tools. The server returns project context and structured task outputs. The host model performs reasoning and generation. | Default for Claude Desktop and Claude Code |
| Server-routed mode | Server invokes llama.cpp or OpenRouter through a model-router service for selected tasks. | Optional for automated draft, rewrite, and batch tasks |

Recommendation: implement Host-led mode first and design the service layer so Server-routed mode plugs in later without changing the MCP tool contracts.

### 7.4 Model priorities

| Priority | Provider | Role |
|---|---|---|
| 1 | llama.cpp | Private local drafting, local outlining, continuity checks, project memory analysis, low-cost batch tasks |
| 2 | OpenRouter | Higher-quality prose passes, long-context tasks, model comparison, fallback route |

Model selection shall be policy-driven. Every model route shall record provider, model name, task type, input scope, output file, and approval status.

## 8. Deployment requirements

### 8.1 Local homelab

The server shall run inside the user’s local homelab. It should support local-only operation first, then LAN access through a controlled Streamable HTTP endpoint.

### 8.2 Windows 11 folder support

The server shall support Windows 11 local paths. It shall accept a configured root writing directory and reject writes outside approved roots.

Required path behaviours:

1. Accept Windows drive paths.
2. Accept UNC paths if enabled.
3. Normalize path separators internally.
4. Prevent path traversal.
5. Store relative project paths in project metadata.
6. Preserve author-created folder names.
7. Support safe moves and archive operations.

### 8.3 Configuration

Configuration shall include:

1. Approved project root directories.
2. llama.cpp endpoint and model aliases.
3. OpenRouter API key reference through environment or secret store.
4. Default model route policies.
5. Export defaults.
6. Content rating defaults.
7. Research citation mode.
8. Log retention period.
9. Backup and archive location.

No API key shall be stored in a manuscript file, Markdown export, DOCX export, or project memory file.

## 9. User roles

| Role | Permissions |
|---|---|
| Author | Creates projects, approves direction, edits all content, approves exports |
| AI assistant | Calls MCP tools through the client and follows project constraints |
| Developer | Builds, tests, and maintains the server |
| Reviewer or editor | Reviews exported drafts and reports, optional future role |

The author remains the decision owner for project direction, style, tone, content rating, final revisions, and publication readiness.

## 10. Core workflow

The server shall support the full novel lifecycle.

### 10.1 Project creation

The author starts with either:

1. One-line idea.
2. Detailed premise.
3. Existing manuscript file.
4. Existing research folder.
5. Mixed input.

The server captures project start settings:

1. Working title.
2. Genre or genre blend.
3. Target length.
4. Audience and content rating.
5. Structure model.
6. Style profiles, up to 5.
7. Point of view.
8. Tense.
9. Setting.
10. Research requirements.
11. Do-not-use list, if supplied.
12. Export targets.

### 10.2 Planning sequence

Recommended order:

1. Premise.
2. Logline.
3. Short synopsis.
4. Full synopsis.
5. Genre contract.
6. Structure selection.
7. Character bible.
8. World bible.
9. Timeline.
10. Chapter outline.
11. Scene outline.
12. Continuity baseline.
13. Draft readiness check.

### 10.3 Drafting sequence

Recommended order per chapter:

1. Load chapter brief.
2. Load relevant character and world notes.
3. Load continuity obligations.
4. Load style guide and genre constraints.
5. Load research notes and citations.
6. Draft scenes.
7. Update project memory.
8. Run continuity check.
9. Store chapter version.
10. Generate author review notes.

### 10.4 Revision sequence

Supported revision passes:

1. Developmental rewrite.
2. Structure rewrite.
3. Character motivation pass.
4. Dialogue pass.
5. Pacing pass.
6. Voice consistency pass.
7. Show-versus-tell pass.
8. Genre expectation pass.
9. Continuity repair pass.
10. Copy edit pass.
11. Proofread pass.
12. Export clean-up pass.

Each pass shall create a new version and preserve the prior version.

### 10.5 Export sequence

Recommended order:

1. Validate project state.
2. Check unresolved continuity issues.
3. Check missing chapters or scenes.
4. Build manuscript in chapter order.
5. Apply front matter and back matter.
6. Produce selected exports.
7. Store export manifest.
8. Record export version.

## 11. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | Create a novel project from one-line idea or detailed premise | Must |
| FR-002 | Create a project from imported manuscript or notes | Must |
| FR-003 | Store project metadata in a persistent project folder | Must |
| FR-004 | Support configurable target length selected by author | Must |
| FR-005 | Support all major genres through an extensible registry | Must |
| FR-006 | Support blended genres with primary and secondary weighting | Must |
| FR-007 | Support up to 5 author or style profiles | Must |
| FR-008 | Convert living-author style requests into neutral style traits | Must |
| FR-009 | Generate premise, logline, synopsis, chapter outline, and scene outline | Must |
| FR-010 | Generate and update character bible | Must |
| FR-011 | Generate and update world bible | Must |
| FR-012 | Store research notes with internal citation metadata | Must |
| FR-013 | Separate factual research from fictional invention | Must |
| FR-014 | Draft chapters from approved outline and project memory | Must |
| FR-015 | Draft individual scenes from scene briefs | Must |
| FR-016 | Track chapter word counts and manuscript progress | Must |
| FR-017 | Run continuity checks before next chapter drafting | Must |
| FR-018 | Track characters, locations, timelines, objects, clues, relationships, and unresolved threads | Must |
| FR-019 | Store version history for outlines, chapters, and rewrites | Must |
| FR-020 | Import TXT, Markdown, DOCX, PDF, EPUB, and CSV | Must |
| FR-021 | Export Markdown, DOCX, EPUB, PDF, and HTML | Must |
| FR-022 | Support Windows 11 local paths | Must |
| FR-023 | Support llama.cpp as first model route | Must |
| FR-024 | Support OpenRouter as second model route | Must |
| FR-025 | Support task-level model selection | Must |
| FR-026 | Provide MCP tools, resources, and prompts | Must |
| FR-027 | Provide audit logs for file writes and model routes | Must |
| FR-028 | Provide safe project archive and backup features | Should |
| FR-029 | Provide import validation and duplicate detection | Should |
| FR-030 | Provide future UI-ready API boundaries | Should |

## 12. Genre system

### 12.1 Genre registry

The server shall ship with a genre registry. The registry shall be extensible by configuration, not hardcoded into the tool logic.

Seed categories:

1. Literary fiction.
2. Commercial fiction.
3. Mystery.
4. Thriller.
5. Crime.
6. Suspense.
7. Romance.
8. Historical fiction.
9. Science fiction.
10. Fantasy.
11. Horror.
12. Adventure.
13. Military fiction.
14. Espionage.
15. Western.
16. Satire.
17. Comedy.
18. Drama.
19. Paranormal.
20. Urban fantasy.
21. Cyberpunk.
22. Dystopian.
23. Post-apocalyptic.
24. Steampunk.
25. LitRPG.
26. Young adult.
27. New adult.
28. Family saga.
29. Legal thriller.
30. Medical thriller.
31. Techno-thriller.
32. Political thriller.
33. Cozy mystery.
34. Police procedural.
35. Noir.
36. Gothic.
37. Supernatural.
38. Alternate history.
39. Slice of life.
40. Experimental fiction.

### 12.2 Genre template contents

Each genre template shall define:

1. Reader promise.
2. Common tropes.
3. Avoided cliches.
4. Typical stakes.
5. Conflict types.
6. Pacing pattern.
7. Tone range.
8. Structure defaults.
9. Character archetypes.
10. Setting expectations.
11. Chapter rhythm.
12. Ending expectations.
13. Market positioning notes.
14. Continuity risks.
15. Research risks.

### 12.3 Genre blending

A genre blend shall contain:

1. Primary genre.
2. Secondary genres.
3. Weight per genre.
4. Dominant reader promise.
5. Required beats from each genre.
6. Conflicting expectations and resolution rule.
7. Pacing compromise.
8. Tone compromise.
9. Ending contract.

Example blend types for testing:

1. Cyberpunk romance.
2. Historical thriller.
3. Fantasy mystery.
4. Military science fiction.
5. Gothic romance.
6. Legal horror.
7. Cozy paranormal mystery.

## 13. Style system

### 13.1 Style profiles

At project start, the author shall specify up to 5 author or style profiles. Profiles fall into three categories:

| Profile type | Handling |
|---|---|
| Public-domain author | Store named profile and trait extraction |
| Living or recent author | Convert to neutral, non-identifying style traits |
| Custom author voice | Store author-defined style guide |

### 13.2 Living-author style handling

The server shall not produce exact imitation of living authors. When the user requests a living author, the server shall translate the request into general traits such as:

1. Sentence length preference.
2. Pacing level.
3. Dialogue density.
4. Description density.
5. Humour level.
6. Emotional intensity.
7. Point-of-view distance.
8. Chapter length pattern.
9. Tension cadence.
10. Vocabulary register.
11. Level of interiority.
12. Exposition style.

The project style guide shall store only the neutral traits, not an instruction to imitate the living author.

### 13.3 Style guide contents

Each project shall maintain:

1. Narrative voice.
2. Point of view.
3. Tense.
4. Diction level.
5. Sentence rhythm.
6. Dialogue rules.
7. Description rules.
8. Humour rules.
9. Profanity rules.
10. Violence level.
11. Sexual content level.
12. Chapter structure.
13. Scene structure.
14. Do-use patterns.
15. Do-not-use patterns.
16. Sample approved paragraph written by the author or approved by the author.

## 14. Manuscript control

### 14.1 Target lengths

The author shall specify target length at project start.

Preset ranges:

| Format | Typical target |
|---|---|
| Flash fiction | Under 1,500 words |
| Short story | 1,500 to 7,500 words |
| Novelette | 7,500 to 17,500 words |
| Novella | 17,500 to 40,000 words |
| Short novel | 40,000 to 60,000 words |
| Standard novel | 60,000 to 90,000 words |
| Long novel | 90,000 to 120,000 words |
| Epic novel | Over 120,000 words |
| Series | Multiple linked books |

The author shall also set chapter count, average chapter length, tolerance range, and total target variance.

### 14.2 Structure models

Built-in structure models:

1. Three-act structure.
2. Four-act structure.
3. Five-act structure.
4. Hero’s journey.
5. Save the Cat style beat sheet.
6. Romance beat structure.
7. Mystery clue trail.
8. Thriller escalation ladder.
9. Horror dread ladder.
10. Fantasy quest structure.
11. Science fiction discovery structure.
12. Crime procedural structure.
13. Custom structure.

Each structure shall map to acts, beats, chapters, scene goals, turning points, stakes, and required payoff points.

### 14.3 Progress tracking

The server shall track:

1. Planned word count.
2. Actual word count.
3. Chapter count.
4. Scene count.
5. Draft status per chapter.
6. Revision status per chapter.
7. Continuity status.
8. Research dependency status.
9. Export readiness.
10. Open author decisions.

## 15. Content rating and safeguards

The author requested broad creative support, including adult content, violence, horror, profanity, and explicit material. The product shall implement configurable content ratings while enforcing legal, platform, and publishing safety boundaries.

Required content settings:

1. Profanity level.
2. Violence level.
3. Gore level.
4. Horror level.
5. Sexual content level.
6. Drug and alcohol depiction level.
7. Psychological distress level.
8. Age category of characters.
9. Reader audience category.
10. Publishing target.

Mandatory restrictions:

1. No sexual content involving minors.
2. No sexualized depiction of characters presented as minors.
3. No instructions for real-world violence, evasion, abuse, exploitation, or crime.
4. No non-consensual sexual content generated for arousal.
5. No personal data exposure from research files without author approval.
6. No copyrighted text ingestion into the final manuscript without author confirmation of rights.

The system shall distinguish fictional depiction, author planning, compliance review, and publishable prose.

## 16. Project memory and continuity

### 16.1 Project memory

Each novel project shall maintain persistent memory in structured files. Memory shall update after each approved planning, drafting, or revision action.

Memory categories:

1. Characters.
2. Relationships.
3. Locations.
4. Timeline.
5. Events.
6. Objects.
7. Clues.
8. Secrets.
9. Promises and payoffs.
10. Rules of the world.
11. Magic, technology, or legal systems.
12. Research facts.
13. Fictional inventions.
14. Unresolved plot threads.
15. Author decisions.
16. Do-not-use list.

### 16.2 Continuity checks

Continuity checks shall run before drafting a next chapter and on demand.

Check types:

1. Character name consistency.
2. Age consistency.
3. Physical description consistency.
4. Location consistency.
5. Time-of-day consistency.
6. Date and timeline consistency.
7. Travel feasibility.
8. Relationship state consistency.
9. Injuries and recovery consistency.
10. Object ownership consistency.
11. Clue placement and payoff consistency.
12. Unresolved promise tracking.
13. World-rule consistency.
14. Style guide consistency.
15. Genre contract consistency.

Continuity reports shall classify issues as blocking, warning, or note.

### 16.3 Blocking rule

A blocking continuity issue shall prevent the server from drafting the next chapter unless the author explicitly approves an override or resolves the issue.

## 17. Research and references

### 17.1 Ingestion

The research service shall ingest:

1. PDFs.
2. Web pages.
3. Plain text notes.
4. Markdown notes.
5. DOCX documents.
6. EPUB files.
7. CSV files.
8. Images with manual notes.

For images, the first release shall store the image file, metadata, and author notes. Later releases shall add OCR and visual extraction if needed.

### 17.2 Research separation

The system shall keep two categories separate:

| Category | Meaning |
|---|---|
| Factual research | Source-backed information from imported material or web pages |
| Fictional invention | Author-created or AI-created story material |

Drafting tools shall not present fictional invention as fact. Research reports shall cite source notes internally for the author.

### 17.3 Research citation metadata

Each research note shall store:

1. Source title.
2. Source type.
3. Source file path or URL.
4. Date added.
5. Extracted note.
6. Relevant chapter or scene.
7. Confidence level.
8. Rights status.
9. Citation label.
10. Author approval status.

### 17.4 Do-not-use list

The author was unsure about this feature. Recommendation: include it as an optional project control.

Do-not-use list categories:

1. Character names.
2. Place names.
3. Themes.
4. Plot devices.
5. Tropes.
6. Words and phrases.
7. Sensitive topics.
8. Real persons.
9. Real organisations.
10. Settings.

## 18. File structure

Each project shall use a fixed folder structure under an approved root path.

Recommended structure:

| Folder or file | Purpose |
|---|---|
| project.json | Project metadata and configuration |
| README.md | Human-readable project summary |
| outline/ | Premise, synopsis, act outline, chapter outline, scene outline |
| bible/characters/ | Character files |
| bible/world/ | World, location, system, and setting files |
| memory/ | Structured project memory and continuity index |
| research/sources/ | Original research files |
| research/notes/ | Extracted notes and citation records |
| drafts/chapters/ | Chapter drafts |
| drafts/scenes/ | Scene drafts |
| revisions/ | Rewrite versions and review notes |
| exports/ | Final generated exports |
| logs/ | Audit logs and tool run summaries |
| backups/ | Optional project snapshots |
| style/ | Style guide, tone guide, genre contract |
| reports/ | Continuity, progress, and export readiness reports |
| trash/ | Recoverable deleted project files |

No tool shall write outside the configured project root.

## 19. Versioning requirements

The server shall version:

1. Premise.
2. Synopsis.
3. Chapter outline.
4. Scene outline.
5. Character bible.
6. World bible.
7. Style guide.
8. Draft chapters.
9. Rewrite passes.
10. Continuity reports.
11. Export packages.

Each version shall store:

1. Version identifier.
2. Parent version.
3. Timestamp.
4. Author or tool action.
5. Summary of change.
6. Model route used, if any.
7. Source files used.
8. Approval status.

## 20. Import and export

### 20.1 Input formats

| Format | Requirement |
|---|---|
| TXT | Import as notes, scenes, chapters, or research |
| Markdown | Import as structured project files or manuscript content |
| DOCX | Import manuscript, notes, or research documents |
| PDF | Import research or source documents |
| EPUB | Import permitted reference material or previous drafts |
| CSV | Import character sheets, timelines, research tables, or outline data |

### 20.2 Export formats

| Format | Requirement |
|---|---|
| Markdown | Project-native readable export |
| DOCX | Editor-ready manuscript export |
| EPUB | Ebook draft export |
| PDF | Review or submission export |
| HTML | Web preview or conversion export |

Export packages shall include an export manifest with timestamp, source versions, word count, chapter count, and unresolved issue status.

## 21. MCP tool catalogue

Tool contracts below describe behaviour and data expectations. They are not implementation code.

### 21.1 Project tools

| Tool | Purpose |
|---|---|
| `create_novel_project` | Create a new novel project with title, genre, target length, style profiles, model policy, and folder path |
| `open_novel_project` | Load an existing project by folder or project ID |
| `list_novel_projects` | List projects under approved roots |
| `validate_project` | Check project structure, missing files, broken references, and configuration errors |
| `archive_project` | Create a safe archive package |
| `backup_project` | Create a backup snapshot |

### 21.2 Planning tools

| Tool | Purpose |
|---|---|
| `generate_premise` | Create or refine premise from idea or notes |
| `generate_logline` | Produce a concise logline |
| `generate_synopsis` | Produce short and full synopsis versions |
| `select_structure_model` | Select or create the structure model |
| `generate_act_outline` | Create act-level outline |
| `generate_chapter_outline` | Create chapter-level outline |
| `generate_scene_outline` | Create scene-level outline |
| `revise_outline` | Revise outlines while preserving version history |
| `validate_outline_against_genre` | Check outline against genre contract |

### 21.3 Bible and memory tools

| Tool | Purpose |
|---|---|
| `create_character_bible` | Create the initial character bible |
| `update_character_bible` | Update character records from approved content |
| `create_world_bible` | Create world and setting records |
| `update_world_bible` | Update world facts, rules, locations, and systems |
| `extract_memory_from_chapter` | Extract continuity facts from chapter drafts |
| `update_project_memory` | Apply approved memory updates |
| `list_open_threads` | List unresolved promises, mysteries, clues, and plot threads |
| `resolve_thread` | Mark a thread as resolved with chapter and scene reference |

### 21.4 Drafting tools

| Tool | Purpose |
|---|---|
| `draft_chapter` | Draft a chapter from outline, style guide, research, and memory |
| `draft_scene` | Draft one scene from scene brief |
| `expand_scene` | Expand a short scene into fuller prose |
| `condense_scene` | Reduce a scene while preserving events |
| `continue_chapter` | Continue an existing chapter from the last approved point |
| `rewrite_chapter` | Rewrite a chapter using a selected revision pass |
| `rewrite_scene` | Rewrite a scene using a selected revision pass |
| `generate_transition` | Create transition text between scenes or chapters |

### 21.5 Review and continuity tools

| Tool | Purpose |
|---|---|
| `check_continuity` | Run full continuity analysis |
| `check_chapter_readiness` | Check whether next chapter drafting is safe |
| `check_style_consistency` | Check prose against project style guide |
| `check_genre_contract` | Check whether draft satisfies genre expectations |
| `check_pacing` | Analyse pacing by chapter and scene |
| `check_dialogue_consistency` | Check character voice and dialogue patterns |
| `generate_revision_plan` | Produce a structured revision plan |
| `compare_versions` | Summarise differences between versions |

### 21.6 Research tools

| Tool | Purpose |
|---|---|
| `ingest_research_file` | Add TXT, Markdown, DOCX, PDF, EPUB, or CSV source material |
| `ingest_research_url` | Add web page research notes if web access is enabled |
| `create_research_note` | Add manual research note |
| `search_research_notes` | Search research notes and citations |
| `link_research_to_scene` | Attach research notes to a scene or chapter |
| `separate_fact_from_invention` | Classify notes as factual research or fictional invention |
| `generate_research_brief` | Produce research brief for a chapter, scene, or topic |

### 21.7 Style and genre tools

| Tool | Purpose |
|---|---|
| `create_style_profile` | Build a profile from public-domain author, living-author traits, or custom style notes |
| `merge_style_profiles` | Merge up to 5 style profiles into one project guide |
| `generate_style_guide` | Create project style guide |
| `update_style_guide` | Revise the style guide after author approval |
| `create_genre_contract` | Create genre and blended-genre requirements |
| `update_genre_contract` | Revise genre contract |
| `check_living_author_request` | Convert living-author imitation requests into neutral traits |

### 21.8 Export tools

| Tool | Purpose |
|---|---|
| `build_manuscript` | Compile approved chapters into manuscript order |
| `generate_front_matter` | Create title page, contents placeholder, dedication, acknowledgements, or author notes as selected |
| `generate_back_matter` | Create back matter as selected |
| `export_manuscript` | Export Markdown, DOCX, EPUB, PDF, or HTML |
| `generate_export_manifest` | Store source versions and export details |
| `check_export_readiness` | Check unresolved issues before export |

### 21.9 Configuration and audit tools

| Tool | Purpose |
|---|---|
| `get_server_config` | Return safe, non-secret configuration details |
| `update_model_policy` | Update model routing rules |
| `test_model_route` | Validate llama.cpp or OpenRouter route without exposing secrets |
| `list_audit_events` | Show project audit records |
| `summarise_project_status` | Return current project status |

## 22. MCP resources

The server shall expose read-only resources for project state. Resource naming shall be stable and predictable.

| Resource | Purpose |
|---|---|
| `novel://projects` | List available projects |
| `novel://project/{projectId}/summary` | Project summary |
| `novel://project/{projectId}/status` | Progress, word count, and readiness |
| `novel://project/{projectId}/style-guide` | Current style guide |
| `novel://project/{projectId}/genre-contract` | Current genre contract |
| `novel://project/{projectId}/characters` | Character bible index |
| `novel://project/{projectId}/world` | World bible index |
| `novel://project/{projectId}/outline` | Current outline |
| `novel://project/{projectId}/timeline` | Timeline index |
| `novel://project/{projectId}/continuity` | Latest continuity report |
| `novel://project/{projectId}/research` | Research index |
| `novel://project/{projectId}/open-threads` | Unresolved plot threads |
| `novel://project/{projectId}/exports` | Export history |

## 23. MCP prompts

Prompts shall be reusable workflows. The server shall expose them as MCP prompts, not hidden implementation prompts.

| Prompt | Purpose |
|---|---|
| `novel_project_kickoff` | Guide author through project creation |
| `premise_development` | Expand an idea into premise options |
| `genre_contract_review` | Check genre and blend expectations |
| `style_profile_builder` | Build neutral style traits |
| `character_bible_builder` | Create character bible |
| `world_bible_builder` | Create world bible |
| `chapter_outline_workshop` | Produce chapter outline |
| `scene_outline_workshop` | Produce scene outline |
| `chapter_drafting_brief` | Prepare model context for drafting |
| `continuity_review` | Review chapter continuity |
| `revision_pass_planner` | Plan rewrite passes |
| `export_readiness_review` | Check manuscript before export |

## 24. Data model

This is a conceptual data model. Developers shall convert it into implementation types during build.

| Entity | Key fields |
|---|---|
| Project | ID, title, root path, created date, status, target length, genre blend, structure model, model policy |
| GenreProfile | ID, name, weight, tropes, pacing, tone, reader promise, required beats |
| StyleProfile | ID, source type, traits, restrictions, sample text reference, approval status |
| Character | ID, name, aliases, role, age, physical description, goals, fears, secrets, voice notes, arc |
| Relationship | ID, characters, state, history, tension, changes by chapter |
| Location | ID, name, description, rules, geography, linked scenes |
| TimelineEvent | ID, date or sequence, chapter, scene, characters, consequences |
| ObjectRecord | ID, name, owner, location, status, importance, continuity notes |
| PlotThread | ID, type, opened in, expected payoff, status, resolved in |
| ResearchSource | ID, title, source type, path or URL, rights status, date added |
| ResearchNote | ID, source, note, citation label, linked chapter, confidence, factual status |
| Chapter | ID, number, title, outline status, draft status, word count, version |
| Scene | ID, chapter, order, point of view, goal, conflict, outcome, word count |
| DraftVersion | ID, parent, file path, version label, model route, created date, approval status |
| ContinuityIssue | ID, severity, entity, description, source location, recommended action, status |
| ExportPackage | ID, formats, source versions, word count, created date, manifest path |
| AuditEvent | ID, timestamp, action, tool, project, file path, model route, result |

## 25. Prompt contracts

Prompt contracts define the required behaviour of writing prompts. They are not implementation code.

### 25.1 Shared prompt rules

Every generation prompt shall receive:

1. Project summary.
2. Genre contract.
3. Style guide.
4. Relevant outline section.
5. Relevant memory records.
6. Relevant research notes.
7. Continuity obligations.
8. Content rating settings.
9. Author instructions.
10. Required output format.

Every generation prompt shall return:

1. Main output.
2. Assumptions made.
3. Continuity updates suggested.
4. Research notes used.
5. Open questions for author review.
6. Risk flags.

### 25.2 Drafting prompt requirements

Drafting prompts shall:

1. Follow approved outline.
2. Preserve character voice and facts.
3. Respect target word count range.
4. Respect content rating.
5. Use style guide traits.
6. Use research notes where relevant.
7. Avoid exact living-author imitation.
8. Avoid contradiction with project memory.
9. Produce only the requested chapter or scene.
10. Return memory update suggestions separately from draft prose.

### 25.3 Revision prompt requirements

Revision prompts shall:

1. State selected revision pass.
2. Preserve approved plot events unless instructed otherwise.
3. Preserve continuity facts.
4. Mark changed intent in revision notes.
5. Keep author voice and style guide.
6. Return a concise change summary.

### 25.4 Continuity prompt requirements

Continuity prompts shall:

1. Compare draft against project memory.
2. Identify contradictions.
3. Identify missing payoffs.
4. Identify timeline issues.
5. Identify unsupported facts.
6. Classify severity.
7. Recommend specific repairs.
8. State whether next chapter drafting is blocked.

## 26. Security requirements

### 26.1 File safety

1. All file operations shall stay inside approved project roots.
2. The server shall reject path traversal.
3. The server shall never overwrite a file without versioning or backup.
4. Deleted files shall move to recoverable trash by default.
5. Imports shall record original file path and source type.
6. Exports shall not include secrets or audit logs unless explicitly requested.

### 26.2 Model and privacy safety

1. Local llama.cpp shall be the default route for private material.
2. OpenRouter routing shall require project-level approval.
3. Each cloud route shall record what content scope was sent.
4. API keys shall be read from secret storage or environment only.
5. Logs shall redact secrets.
6. Research sources shall track rights status.
7. The server shall separate source text from generated prose.

### 26.3 MCP trust requirements

1. Tools shall have clear names and descriptions.
2. Write operations shall be explicit.
3. Destructive operations shall require approval through the client.
4. Tool lists shall remain deterministic.
5. Tool outputs shall report files created or changed.
6. Long operations shall report progress where supported.
7. Errors shall be actionable and non-secret.

## 27. Acceptance criteria

### 27.1 Project creation

A project is accepted when:

1. A new project folder is created under an approved root.
2. Metadata file exists.
3. Required folders exist.
4. Project appears in project listing.
5. Default model policy is stored.
6. Style and genre setup placeholders exist.
7. Audit record exists.

### 27.2 Planning

Planning is accepted when:

1. Premise, synopsis, chapter outline, and scene outline are generated.
2. Files are versioned.
3. Genre contract is created.
4. Style guide is created.
5. Character and world bibles are created.
6. Author review notes are stored.

### 27.3 Drafting

Chapter drafting is accepted when:

1. Draft uses approved outline.
2. Draft file is saved in the correct folder.
3. Word count is recorded.
4. Version history is updated.
5. Continuity update suggestions are generated.
6. Audit record exists.

### 27.4 Continuity

Continuity check is accepted when:

1. Report identifies issues by severity.
2. Blocking issues prevent next chapter drafting unless overridden.
3. Open threads are updated.
4. Resolved threads link to chapter and scene.
5. Report is saved and versioned.

### 27.5 Research

Research ingestion is accepted when:

1. Source file is stored or referenced.
2. Notes are indexed.
3. Factual notes are separated from fictional invention.
4. Citation metadata exists.
5. Linked chapters or scenes are recorded where applicable.

### 27.6 Export

Export is accepted when:

1. Selected formats are produced.
2. Export manifest exists.
3. Word count and source versions are recorded.
4. Unresolved issues are listed.
5. Export files open successfully.

## 28. Test plan

| Test ID | Scenario | Expected result |
|---|---|---|
| T-001 | Create project from one-line idea | Project folder, metadata, outline placeholders, audit record created |
| T-002 | Create project from detailed premise | Premise preserved and planning outputs generated |
| T-003 | Use blended genre | Genre contract includes weights and conflict resolution rules |
| T-004 | Add 5 style profiles | Combined style guide created without exact living-author imitation |
| T-005 | Try 6 style profiles | Server rejects or asks author to reduce to 5 |
| T-006 | Draft chapter before continuity check | Server runs readiness check first |
| T-007 | Blocking continuity issue exists | Drafting is blocked until resolved or overridden |
| T-008 | Import PDF research | Source and notes stored with citation metadata |
| T-009 | Import DOCX manuscript | Chapter or notes import succeeds with structure preserved where practical |
| T-010 | Export DOCX | DOCX appears in exports folder and manifest lists source versions |
| T-011 | Export all formats | Markdown, DOCX, EPUB, PDF, and HTML are produced |
| T-012 | Path traversal attempt | Server rejects the path |
| T-013 | OpenRouter route disabled | Server does not send content to OpenRouter |
| T-014 | llama.cpp route configured | Local task uses configured local model alias |
| T-015 | Research note marked fictional | Drafting does not cite it as factual research |
| T-016 | Delete draft | Draft moves to recoverable trash or creates backup first |
| T-017 | Rewrite chapter | New version is created and prior version preserved |
| T-018 | Project archive | Archive package includes manifest and excludes secrets |
| T-019 | Claude Desktop connection | Tools, resources, and prompts list successfully |
| T-020 | Claude Code connection | Same core tools appear in deterministic order |

## 29. Build phases

### Phase 1 - Foundation

Deliver:

1. TypeScript project scaffold.
2. MCP stdio transport.
3. Tool, resource, and prompt registration framework.
4. Project folder creation.
5. Configuration service.
6. Basic audit logging.
7. Claude Desktop connection test.
8. Claude Code connection test.

### Phase 2 - Project structure and memory

Deliver:

1. Fixed project folder structure.
2. Project metadata validation.
3. Character bible storage.
4. World bible storage.
5. Memory records.
6. Open thread tracking.
7. Versioning foundation.

### Phase 3 - Planning tools

Deliver:

1. Premise tools.
2. Synopsis tools.
3. Genre contract tools.
4. Style guide tools.
5. Structure model tools.
6. Chapter outline tools.
7. Scene outline tools.

### Phase 4 - Research and import

Deliver:

1. TXT import.
2. Markdown import.
3. DOCX import.
4. PDF import.
5. EPUB import.
6. CSV import.
7. Research note indexing.
8. Fact versus invention separation.

### Phase 5 - Drafting and revision

Deliver:

1. Chapter drafting.
2. Scene drafting.
3. Expansion and condensation.
4. Rewrite passes.
5. Version comparison summaries.
6. Word count progress tracking.

### Phase 6 - Continuity and readiness

Deliver:

1. Continuity checker.
2. Chapter readiness checker.
3. Blocking issue rule.
4. Style consistency checker.
5. Genre contract checker.
6. Pacing checker.

### Phase 7 - Model routing

Deliver:

1. llama.cpp model route.
2. OpenRouter model route.
3. Task-level model policy.
4. Route audit records.
5. Approval rules for cloud routing.
6. Provider health test.

### Phase 8 - Export

Deliver:

1. Manuscript builder.
2. Markdown export.
3. DOCX export.
4. EPUB export.
5. PDF export.
6. HTML export.
7. Export manifest.
8. Export readiness report.

### Phase 9 - Hardening and release

Deliver:

1. Path safety tests.
2. Secret redaction tests.
3. Large-project performance tests.
4. Long manuscript workflow tests.
5. Documentation.
6. Installation guide for Windows 11 and homelab deployment.
7. Backup and restore guide.

## 30. Developer handoff instructions

### 30.1 Codex tasks

Codex should start with:

1. Create TypeScript MCP Server scaffold.
2. Implement stdio transport first.
3. Create deterministic tool registry.
4. Create project folder and metadata services.
5. Implement validation before generation features.
6. Add test fixtures for a small novel project.
7. Add path safety tests early.
8. Add audit logging early.

Codex should not start with drafting logic. It should first make project creation, state management, and MCP integration stable.

### 30.2 Claude Code tasks

Claude Code should focus on:

1. Refactoring service boundaries.
2. Reviewing tool contracts.
3. Reviewing prompt contract behaviour.
4. Building test coverage.
5. Checking MCP client compatibility.
6. Reviewing file safety and secret handling.
7. Improving developer documentation.

### 30.3 Human developer review

Human review should focus on:

1. Architecture fit.
2. Model routing privacy.
3. Path safety.
4. Export quality.
5. Long manuscript performance.
6. Copyright and style handling.
7. Author workflow quality.

## 31. Operational requirements

1. Server startup shall validate configuration.
2. Server startup shall fail safely if approved roots are missing.
3. Server shall log non-secret operational events.
4. Server shall expose project status through resource reads.
5. Server shall handle large manuscripts without corrupting files.
6. Server shall preserve drafts before rewrites.
7. Server shall support graceful interruption of long tasks where the client supports cancellation.
8. Server shall return actionable errors.
9. Server shall include a diagnostic command for model routes.
10. Server shall include backup and archive procedures.

## 32. Future roadmap

1. Web dashboard for project status.
2. Visual plot board.
3. Timeline graph.
4. Relationship graph.
5. Character voice fingerprinting.
6. Manuscript heat maps for pacing and tension.
7. Scrivener export.
8. Git-backed versioning.
9. Multi-book series bible.
10. Collaborative editor mode.
11. Editor and beta-reader roles.
12. Automated ebook validation.
13. Cover brief generator.
14. Query letter and synopsis package generator.
15. Agentic task queue for batch revisions.
16. Local vector search for research and memory.
17. OCR and image-note extraction.
18. Speech-to-notes import.

## 33. Open questions for later design

These questions do not block the first build.

1. Should cloud routing be disabled by default for every project?
2. Which local llama.cpp model aliases should ship as defaults?
3. Should OpenRouter model choices be locked per project or per task?
4. Should the author approve each chapter draft before memory updates are applied?
5. Should export templates match publisher manuscript standards or ebook-first standards?
6. Should the server support Git as an optional version backend?
7. Should research ingestion store full text, extracted notes only, or both?
8. Should the do-not-use list block drafting or warn only?
9. Should adult content settings be per project, per chapter, or per scene?
10. Should the future UI run as a separate app or inside the MCP Server package?

## 34. Implementation constraints

1. Use TypeScript.
2. Target Claude Desktop and Claude Code first.
3. Support local Windows 11 folders.
4. Keep MCP layer separate from business logic.
5. Keep model-router layer separate from MCP tool contracts.
6. Use llama.cpp first.
7. Use OpenRouter second.
8. Do not store secrets in project files.
9. Do not overwrite user files without versioning.
10. Do not imitate living authors directly.
11. Do not generate publish-ready output from factual research unless rights status is clear.
12. Do not write implementation code inside requirements documentation.

## 35. Source references

The following sources informed the MCP and model integration design. Accessed 2026-06-25.

1. Model Context Protocol specification, 2025-11-25, https://modelcontextprotocol.io/specification/2025-11-25
2. Model Context Protocol transports, 2025-11-25, https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
3. Model Context Protocol tools specification draft, https://modelcontextprotocol.io/specification/draft/server/tools
4. MCP TypeScript SDK documentation, https://ts.sdk.modelcontextprotocol.io/
5. MCP TypeScript SDK GitHub repository, https://github.com/modelcontextprotocol/typescript-sdk
6. OpenRouter quickstart documentation, https://openrouter.ai/docs/quickstart
7. OpenRouter API reference, https://openrouter.ai/docs/api/reference/overview
8. llama.cpp server documentation, https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md

---

## 36. Glossary

| Term | Definition |
|---|---|
| Genre contract | The set of reader expectations a novel must satisfy to succeed in its genre. Includes required beats, tone range, conflict type, and ending expectations. |
| Reader promise | The implicit agreement a genre makes with a reader about the kind of experience they will receive. For example, a romance promises a satisfying relationship outcome. |
| Plot thread | A narrative element introduced in one chapter that requires acknowledgement or resolution in a later chapter. Includes mysteries, promises, foreshadowing, clues, and character arcs. |
| Continuity obligation | A specific fact or event established in prior chapters that the drafting service must not contradict. |
| Blocking issue | A continuity or readiness problem severe enough to prevent the server from drafting the next chapter without explicit author override. |
| Style profile | A named set of prose style traits applied to a project. May derive from a public-domain author, neutral living-author traits, or a custom author-defined guide. |
| Host-led mode | Operating mode where the MCP client model performs generation. The server provides context and structured task outputs but does not call a model itself. |
| Server-routed mode | Operating mode where the server invokes llama.cpp or OpenRouter directly for selected tasks without requiring the client model to generate prose. |
| Fictional invention | Story material created by the author or AI that is not backed by a factual research source. Must be stored separately from factual research. |
| Factual research | Source-backed information from imported documents, notes, or web pages. Must be cited and kept separate from fictional invention. |
| Do-not-use list | An optional per-project list of names, themes, tropes, phrases, or topics the author does not want the AI to use in any generated output. |
| Draft version | A saved snapshot of a chapter or scene at a specific point in time, identified by a version label and linked to its parent version. |
| Revision pass | A focused rewrite of a chapter or scene targeting one specific quality dimension, such as pacing, dialogue, or continuity. |
| Export manifest | A record attached to each export package listing the source version of every chapter, word count, unresolved issues, and export timestamp. |
| Approved root | A file system path configured by the author as a permitted location for project folders. The server will not write outside approved roots. |

---

## 37. Context window management

### 37.1 Problem

A novel project accumulates more content than any single model context window can hold. A 100,000-word manuscript plus character bible, world bible, research notes, and style guide may exceed 150,000 tokens. Local llama.cpp models typically support 4,096 to 32,768 tokens. Sending the full project state to every tool call is not feasible.

### 37.2 Context assembly strategy

The server shall assemble a focused context for each tool call. The context assembly service shall select only the records relevant to the current task.

Rules per task type:

| Task type | Included context |
|---|---|
| Chapter draft | Chapter outline, POV character record, characters appearing in chapter, locations appearing in chapter, scene-linked research notes, continuity obligations for chapter, style guide summary, genre contract summary |
| Continuity check | All character records, all location records, full timeline, all open plot threads, prior chapter summaries, current chapter draft |
| Style check | Style guide full text, sample approved paragraph, current chapter or scene draft |
| Research brief | Research notes linked to target chapter or scene, world bible sections linked to topic |
| Export | Full manuscript in chapter order, front matter, back matter, export manifest template |

### 37.3 Context size limits

The configuration service shall store a context budget per model alias. Before assembling context, the server shall estimate token count. If the assembled context exceeds the configured budget, the server shall:

1. Log a warning identifying which records were trimmed.
2. Drop lowest-priority context in this order: distant research notes, unlinked world bible entries, earlier timeline events, older audit summaries.
3. Never trim: the current chapter brief, the active character records, the style guide summary, and the continuity obligations for the current chapter.
4. Notify the author through the tool response that context was trimmed and which categories were excluded.

### 37.4 Summary records

The memory service shall maintain a short summary alongside every full record. Chapter summaries shall be generated after each approved draft and stored separately from the full chapter text. Continuity checks and context assembly shall use summaries by default and load full records only when the task requires it.

---

## 38. Atomic write and partial-failure safety

### 38.1 Write strategy

Every file write operation shall use an atomic write pattern:

1. Write new content to a temporary file in the same directory with a `.tmp` suffix.
2. Validate the temporary file is complete and not empty.
3. Rename the temporary file to the target path.
4. On rename failure, preserve the temporary file and log the failure with both paths.
5. Never delete the prior version before the new version is confirmed written.

### 38.2 Export failure handling

Export operations that produce multiple files (DOCX, EPUB, PDF, HTML) shall:

1. Write each format to a temporary export staging folder first.
2. Move the staging folder to the final exports path only when all selected formats have completed.
3. On partial failure, preserve whatever was successfully written in the staging folder and report which formats succeeded and which failed.
4. Never overwrite a prior successful export package on partial failure.

### 38.3 Crash recovery

On server startup, the server shall scan approved project roots for orphaned `.tmp` files. It shall log each one with a warning and leave them in place for author review. It shall not silently delete or rename them.

### 38.4 Acceptance criteria

Atomic write safety is accepted when:

1. A write interrupted mid-operation leaves the prior version intact.
2. An orphaned `.tmp` file on startup produces a logged warning and does not prevent server startup.
3. A partial export failure leaves prior exports untouched.

---

## 39. Revision pass entity

This supplements Section 24 (Data model) and Section 10.4 (Revision sequence).

### 39.1 RevisionPass entity

| Field | Description |
|---|---|
| ID | Unique revision pass identifier |
| pass type | One of the 12 defined pass types from Section 10.4, or custom |
| instructions | Author-supplied or template instructions for this pass |
| scope | Chapter, scene, or manuscript |
| target chapter or scene | Reference to the item being revised |
| input version | Version ID of the draft being revised |
| output version | Version ID produced by this pass |
| change summary | Brief description of changes made |
| model route | Model used if server-routed mode was active |
| created date | Timestamp |
| approval status | Pending, approved, or rejected by author |

### 39.2 Revision history

The revision service shall maintain a linked chain of RevisionPass records for each chapter. This allows the author to trace every change from first draft through final approved version, including which pass type produced each version and which model was used.

---

## 40. Memory management tools (additions to Section 21.3)

The following tools shall be added to the bible and memory tool catalogue.

| Tool | Purpose |
|---|---|
| `remove_character` | Move a character record to archived state, log removal reason, update open threads referencing the character |
| `remove_location` | Move a location record to archived state, log removal reason, update scenes referencing the location |
| `remove_plot_thread` | Move a plot thread to archived state with a reason of abandoned, log which chapter and scene it was opened in |
| `restore_archived_record` | Restore a previously archived character, location, or plot thread record |
| `list_archived_records` | List all archived characters, locations, and plot threads for a project |

### 40.1 Archiving rules

Removal tools shall not perform hard deletes. Archived records shall:

1. Move to a dedicated `memory/archive/` subfolder.
2. Retain all original fields.
3. Store a removal reason, removal date, and the chapter or scene active at time of removal.
4. Be excluded from continuity checks and context assembly by default.
5. Remain restorable by the author at any time.

---

## 41. Import mapping tools (additions to Section 21.2 and 21.3)

The import service (Section 20.1) accepts TXT, Markdown, DOCX, PDF, EPUB, and CSV. The following tools complete the bridge between raw import and structured project data.

| Tool | Purpose |
|---|---|
| `import_outline_from_file` | Parse an imported Markdown or CSV file into the project outline structure, with author review before saving |
| `import_character_bible_from_file` | Parse an imported CSV or Markdown character sheet into character bible records, with duplicate detection |
| `import_world_bible_from_file` | Parse an imported Markdown or CSV world notes file into world bible records |
| `import_timeline_from_file` | Parse an imported CSV timeline into timeline event records |
| `preview_import` | Show a structured preview of how an imported file will map to project records before committing |
| `confirm_import` | Commit a previewed import after author review |
| `reject_import` | Discard a previewed import without writing any records |

### 41.1 Import review requirement

No import mapping tool shall write records to the project without an explicit author confirmation step. The `preview_import` tool shall always be called first. The `confirm_import` or `reject_import` tool completes the operation. This prevents silently overwriting an existing bible with a mismatched file.

---

## 42. Configuration validation on startup

This supplements Section 8.3 and Section 31.

### 42.1 Startup validation sequence

On startup, the configuration service shall validate the following in order:

1. At least one approved project root is configured.
2. Each configured approved root exists and is accessible.
3. The llama.cpp endpoint is reachable if a local model policy is active.
4. The OpenRouter API key reference resolves to a non-empty value if an OpenRouter policy is active.
5. The export default folder exists or can be created.
6. The log retention period is a valid positive integer.
7. The backup location exists if backup is enabled.

### 42.2 Startup failure output

If any required configuration item fails validation, the server shall:

1. Emit a structured startup error listing each invalid or missing setting by name.
2. State for each failure: the setting name, the problem, and a suggested fix.
3. Exit without starting the MCP transport.
4. Never start in a partially configured state.

Example output format:

```
Configuration error: server cannot start.

  approved_roots: no roots configured. Add at least one valid Windows path to approved_roots in config.json.
  llama_cpp_endpoint: endpoint http://localhost:8080 is not reachable. Check that llama.cpp server is running.
```

### 42.3 Acceptance criteria

Configuration validation is accepted when:

1. A missing approved root produces a named error and prevents startup.
2. An unreachable llama.cpp endpoint produces a named error and prevents startup when a local model policy is active.
3. A valid configuration produces a clean startup log with no errors.
4. The error output names the setting, describes the problem, and suggests a fix.

---

## 43. Content safety test additions (additions to Section 28)

The following tests supplement the test plan in Section 28.

| Test ID | Scenario | Expected result |
|---|---|---|
| T-021 | Draft request with content rating set to general audience and scene contains explicit adult content | Server flags a content rating violation before producing output |
| T-022 | Author requests style profile based on a named living author | Server converts request to neutral style traits and stores no direct imitation instruction |
| T-023 | Style guide produced from living-author conversion | Style guide contains only trait-level descriptions with no author name and no copied prose |
| T-024 | Research note classified as fictional invention is referenced in a draft | Draft tool does not present the note as factual research in its output |
| T-025 | Drafting prompt includes a character presented as a minor in an adult-rated scene | Server flags a mandatory content restriction violation and refuses to produce the output |

---

## 44. MCP tool input schema requirement

This supplements Section 26.3 (MCP trust requirements).

### 44.1 Input schema declaration

Every MCP tool exposed by the server shall declare a JSON Schema object for its input parameters. The schema shall be part of the tool registration and shall be returned when the client requests the tool list.

Required schema fields per tool:

1. Parameter name.
2. Parameter type.
3. Required or optional status.
4. Description of the parameter.
5. Constraints such as minimum length, maximum length, enum values, or pattern where applicable.

### 44.2 Input validation rule

The server shall validate all tool inputs against the declared schema before executing any file operation, model call, or memory update. If validation fails, the server shall return a structured error naming the invalid parameter, the value received, and the constraint violated. It shall not execute the tool body.

### 44.3 Acceptance criteria

Input schema validation is accepted when:

1. A tool call with a missing required parameter returns a named validation error without executing the tool.
2. A tool call with an out-of-range parameter value returns a named validation error.
3. A valid tool call passes validation and executes normally.
4. The tool list returned to the client includes the input schema for every tool.

---

## 45. Granular MCP resources (additions to Section 22)

The following sub-resources supplement the resource list in Section 22. They allow clients to load individual records without fetching the full index.

| Resource | Purpose |
|---|---|
| `novel://project/{projectId}/outline/chapter/{chapterNumber}` | Single chapter outline entry |
| `novel://project/{projectId}/outline/scene/{sceneId}` | Single scene outline entry |
| `novel://project/{projectId}/characters/{characterId}` | Full record for one character |
| `novel://project/{projectId}/world/{locationId}` | Full record for one location or world entry |
| `novel://project/{projectId}/research/note/{noteId}` | Full record for one research note |
| `novel://project/{projectId}/threads/{threadId}` | Full record for one plot thread |
| `novel://project/{projectId}/chapters/{chapterId}/summary` | Summary of one drafted chapter |
| `novel://project/{projectId}/chapters/{chapterId}/continuity` | Continuity issues specific to one chapter |

### 45.1 Index versus detail pattern

Index resources (e.g., `novel://project/{projectId}/characters`) shall return a list of IDs, names, and one-line descriptions only. Detail resources shall return the full record. This prevents context window exhaustion when a project has many characters, locations, or research notes.

---

## 46. Project deletion tool (addition to Section 21.1)

| Tool | Purpose |
|---|---|
| `delete_novel_project` | Move a project folder to a recoverable archive location outside the approved project root, or permanently delete after explicit author double-confirmation |

### 46.1 Deletion rules

1. `delete_novel_project` shall not perform an immediate hard delete.
2. The default behaviour is to move the entire project folder to a configured recycle location.
3. Permanent deletion shall require the author to supply the project title as a confirmation parameter.
4. The audit log entry for a deletion shall be preserved outside the deleted project folder.
5. A deleted project shall not appear in `list_novel_projects`.

---

## 47. Resolved open questions

The following open questions from Section 33 are resolved here to remove build ambiguity.

| Question | Decision | Reason |
|---|---|---|
| Should cloud routing be disabled by default? | Yes. Cloud routing shall be disabled by default for every project. The author must explicitly enable it per project with a confirmation step. | Privacy-first. Local homelab deployment. OpenRouter sends content off-device. |
| Should the do-not-use list block drafting or warn only? | Warn by default. The author may upgrade individual entries to blocking status. | A full block risks frustrating the author on terms they forgot they listed. Warn-first gives visibility without hard stops. |

