---
tags: [vault-setup, onboarding]
---

# Obsidian Vault Setup

This repo root is the Obsidian vault. Open the folder in Obsidian to use.

## Quick Start

1. **Open vault** → Select this repo root (`raaz-secrets-manager/`)
2. **Enable community plugins** (Settings → Community plugins):
   - `obsidian-git` — Git in sidebar (configure: auto-commit 5min, auto-pull)
   - `dataview` — Live queries in notes
   - `obsidian-tasks-plugin` — Task tracking across notes
   - `advanced-canvas` — Mermaid in canvas
   - `obsidian-kanban` — Kanban boards from markdown
3. **Open key files**:
   - `Ctrl+O` → `architecture.canvas` — Visual architecture + code links
   - `Ctrl+O` → `MVP_BOARD.md` → `Ctrl+P` → "Open as Kanban board"
   - `Ctrl+O` → `QUERIES.md` — Copy query blocks into any note
   - `Ctrl+N` → Select template (daily-note, adr, feature-spec, meeting-notes)

## Structure

```
raaz-secrets-manager/          ← Vault root
├── .obsidian/                 ← Editor config (plugins, workspace, templates)
│   └── templates/             ← daily-note, adr, feature-spec, meeting-notes
├── docs/                      ← Project documentation (all tagged)
│   ├── architecture.canvas    ← Visual MERN/RBAC/Crypto/Deployment diagram
│   ├── MVP_BOARD.md           ← Kanban: stories → Phases 1–5
│   ├── QUERIES.md             ← Dataview query reference
│   └── *.md                   ← PRODUCT, ARCHITECTURE, API, DATA_MODEL, etc.
├── client/                    ← Frontend code (linkable via wiki-links)
├── server/                    ← Backend code (linkable via wiki-links)
└── packages/shared-schemas/   ← Shared Zod schemas
```

## Key Features

| Feature | Files |
|---------|-------|
| **Tagged docs** | All `docs/*.md` have frontmatter tags (`#mvp`, `#architecture`, `#api`, etc.) |
| **Code ↔ Doc links** | Wiki-links work across: `[[../server/src/middleware/auth.ts]]` |
| **Visual architecture** | `architecture.canvas` — frames, legend, 15 nodes, code links |
| **MVP tracking** | `MVP_BOARD.md` — Kanban with all 12 stories across 5 phases |
| **Query reference** | `QUERIES.md` — Ready-to-paste Dataview queries |
| **Templates** | `.obsidian/templates/` — Consistent note structure |

## Useful Shortcuts

| Action | Shortcut |
|--------|----------|
| Quick open | `Ctrl+O` |
| Command palette | `Ctrl+P` |
| Graph view | `Ctrl+G` |
| Daily note | `Ctrl+Shift+N` (with template) |
| New from template | `Ctrl+N` → choose template |

## Maintenance

- **New docs**: Add to `docs/README.md` index table
- **New templates**: Add to `.obsidian/templates/`
- **Canvas updates**: Edit in Obsidian (auto-saves JSON)
- **Git**: Left ribbon → Git icon → commit/push

## For AI Agents

Read `AGENTS.md` first, then `docs/README.md`. The vault structure mirrors the doc authority map in AGENTS.md.