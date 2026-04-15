---
name: memory-manager
description: Use when managing the AetherDesk Prime memory bank. Triggers on: "update memory", "save to memory", "remember this", "architecture", "tech stack", "/update-memory". Ensures long-term continuity between agent sessions.
---

# AetherDesk Prime Memory Architecture

## 📂 Memory Bank Layout
All persistent context lives in `.agents/memory/`:
- `project-brief.md`: Mission & Scorecard (Manual + Milestone updates).
- `architecture.md`: Unified Gateway & Data Flow (Auto).
- `tech-stack.md`: Pinned Versions (Auto).
- `context.md`: Active Tasks & Session Log (Auto).
- `patterns/common-tasks.md`: Reusable Execution Patterns (Auto).

## 🧠 Core Directives
1. **Context First**: Always check `context.md` before starting a task.
2. **Standardization**: Use the snippets in `common-tasks.md` to avoid "snowflake" code.
3. **Delta Focus**: Only document significant state changes or architectural pivots.

## 💾 Update Triggers

| Event | Update Logic |
|-------|--------------|
| New Endpoint | Add pattern to `common-tasks.md` + Update `architecture.md` |
| Version Bump | Synchronize `tech-stack.md` |
| Trade Logic Change | Update `project-brief.md` (Constraints section) |
| System Fix | Mark as DONE in `context.md` and `project-brief.md` |

## 🚫 Anti-Patterns (What NOT to store)
- Raw error logs (summarize the root cause instead).
- Ephemeral session IDs.
- Personal credentials or secrets.

## 🔄 Memory Sync Routine
At the close of every session, an agent MUST:
1. Verify `context.md` reflects all applied fixes.
2. Ensure the `Decisions Log` in `architecture.md` is current.
3. Push changes to GitHub if asked, using conventional commit tags.

## [Agents: extend this meta-guide as memory needs evolve]
