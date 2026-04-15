---
description: Start every session by loading memory bank and checking system health progress.
---

# AetherDesk Prime — Session Bootstrap
# Workflow: /start

Run this at the beginning of every session to align with the repository state.

## 1. 📂 Silent Memory Load
Load all project-specific context files from `.agents/memory/`:
- `project-brief.md`, `architecture.md`, `tech-stack.md`, `context.md`, `patterns/common-tasks.md`.

*Status Check:*
🧠 Memory Loaded | System: AetherDesk Prime | Last Action: [last_completed from context.md]

## 2. 📊 System Health Snapshot
Display the current Unification progress from `context.md`:

```
🛡️ AetherDesk Status Board
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Layer          Status     Focus
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Render Table from context.md]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 3. 🚀 Task Selection
Identify the next critical milestone:
- If **Infrastructure** is not FIXED: Suggest `/audit-and-fix`.
- If **Pages** are pending: Suggest `/page-audit [page_name]`.
- If ready for build: Suggest `/deploy-check`.

**Next Recommended Move**: [Task Name]
*Action required: Confirm or specify a different focus.*
