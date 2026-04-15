---
description: Synchronize session activity with the long-term memory bank in .agents/memory/.
---

# AetherDesk Prime — Memory Synchronization
# Workflow: /update-memory

Run this at the end of every session or after completing a high-level milestone to ensure continuity.

## 1. 🔍 Activity Audit
Review the session trail:
- Which Port 18788 endpoints were modified?
- Which UI components (Shadcn/Framer) were standardized?
- Were any DuckDB ingestion patterns optimized?
- Any new `.env` variables added?

## 2. 📝 Context.md Alignment
Update `.agents/memory/context.md`:
- Mark corrected areas as **FIXED**.
- Log the "Last Completed" milestone.
- Add any new "Immediate Backlog" items discovered during code traversal.

## 3. 🧩 Pattern Extraction
Review logic in `algo-trader/` and `trading-ui/`:
- Did we create a new reusable Flask Blueprint pattern?
- Is there a new Framer Motion transition worth saving?
- If yes, append to `.agents/memory/patterns/common-tasks.md`.

## 4. 📐 Architectural Logging
If a core design decision was made (e.g., shifting specific logic from UI to Engine):
- Append to the Decisions Log in `.agents/memory/architecture.md`.
- Format: `| Date | Decision | Rationale | State |`.

## 5. 🏁 Checkpoint Confirmation
Output the following summary:
🧠 **Memory Synced** | [N] files updated.
🏃 **Active Context**: [Active task for next agent]
📍 **Ready for**: `/start`
