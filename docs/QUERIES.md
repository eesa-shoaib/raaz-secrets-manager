---
tags: [dataview, queries, reference]
---

# Dataview Queries Reference

Save these in `docs/QUERIES.md` and pin in Obsidian for quick access.

---

## 📋 MVP Scope

### All MVP-tagged docs
```dataview
TABLE file.link as Doc, tags, status
FROM "docs"
WHERE contains(tags, "mvp")
SORT file.name
```

### MVP scope by domain
```dataview
TABLE file.link as Doc, tags
FROM "docs"
WHERE contains(tags, "mvp")
GROUP BY regexmatch(file.name, "(ARCHITECTURE|API|DATA_MODEL|FRONTEND|PRODUCT|PROJECT_STRUCTURE|TECH_STACK)")
```

### Post-MVP items (from PRODUCT.md Cut table)
```dataview
TABLE file.link as Doc, tags
FROM "docs"
WHERE contains(tags, "post-mvp")
SORT file.name
```

---

## 🏷️ Tag Index

### All unique tags across docs
```dataview
LIST tags
FROM "docs"
FLATTEN tags
GROUP BY tags
```

### Docs by tag
```dataview
TABLE file.link as Doc
FROM "docs"
WHERE contains(tags, this.tag)
SORT file.name
```
*Usage: Replace `this.tag` with any tag (e.g., `mvp`, `architecture`, `api`, `rbac`, `encryption`)*

---

## ✅ Task Tracking

### All uncompleted tasks in docs
```dataview
TASK FROM "docs"
WHERE !completed
GROUP BY file.link
```

### Tasks by status
```dataview
TASK FROM "docs"
GROUP BY completed
```

### MVP Board tasks (from MVP_BOARD.md)
```dataview
TASK FROM "docs/MVP_BOARD.md"
WHERE !completed
GROUP BY section
```

---

## 🔗 Cross-References

### Backlinks to ARCHITECTURE.md
```dataview
LIST
FROM [[ARCHITECTURE.md]]
```

### Outgoing links from a doc
```dataview
LIST
FROM outgoing([[]])
```
*Usage: Open any doc, run this to see what it links to*

### Orphaned docs (no incoming links)
```dataview
LIST
FROM "docs"
WHERE length(file.inlinks) = 0
```

---

## 📝 Frontmatter Queries

### All docs with their frontmatter
```dataview
TABLE file.link as Doc, tags, status, date
FROM "docs"
SORT file.name
```

### Docs missing frontmatter
```dataview
TABLE file.link as Doc
FROM "docs"
WHERE !tags
```

---

## 🎯 Phase Tracking (from FRONTEND.md)

### Phase completion status
```dataview
TASK FROM "docs/FRONTEND.md"
WHERE contains(text, "Phase")
GROUP BY status
```

---

## 🔍 Search Helpers

### Find all `TODO` comments in docs
```dataview
LIST
FROM "docs"
WHERE contains(file.content, "TODO")
```

### Find all `FIXME` / `XXX` in docs
```dataview
LIST
FROM "docs"
WHERE contains(file.content, "FIXME") OR contains(file.content, "XXX")
```

### Find docs mentioning a specific term
```dataview
TABLE file.link as Doc
FROM "docs"
WHERE contains(lower(file.content), "encryption")
SORT file.name
```
*Replace `"encryption"` with any term*

---

## 💡 How to Use

1. **Copy a query block** → paste into any note → it renders live
2. **Pin this note** → `Ctrl+P` → "Pin tab" for quick access
3. **Create a Dashboard canvas** → embed query blocks as cards
4. **Keyboard shortcut**: `Ctrl+Shift+P` → "Dataview: Execute query" to run ad-hoc

---

## 🛠️ Dataview Tips

| Tip | How |
|-----|-----|
| Inline query | `` `= this.tags` `` renders current note's tags |
| Render as list | Add `LIST` instead of `TABLE` |
| Limit results | Add `LIMIT 10` at end |
| Date filtering | `WHERE date(file.ctime) >= date("2026-01-01")` |
| Regex match | `WHERE regexmatch(file.name, "ARCHITECTURE|API")` |

See: [Dataview Docs](https://blacksmithgu.github.io/obsidian-dataview/)