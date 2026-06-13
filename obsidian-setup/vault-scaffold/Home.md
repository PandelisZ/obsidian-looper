---
type: dashboard
tags:
  - orchestrator
  - home
---

# {{project}} — Orchestrator Home

This is the orchestrator's workspace. Claude reads and writes here continuously when the loop is running.

---

## Quick links

- [[Inbox]] — drop asks here as `- [ ] ...` checkboxes
- [[Roadmap]] — rolling priorities
- [[_status-options]] — valid status values (do not delete)

---

## Review cycle

| Status | Meaning |
|--------|---------|
| `draft` | Claude is working on it — not ready for your eyes yet |
| `needs-review` | Ready for your review — read the note and set a new status |
| `approved` | You've approved it — Claude will execute on the next loop tick |
| `changes-requested` | Write your feedback under `## Review` in the note — Claude will revise |
| `in-progress` | Claude is actively executing the plan |
| `done` | Completed |
| `parked` | Paused indefinitely |

To approve or request changes: open the note, click the `status` chip at the top, pick a value, and optionally write under `## Review`.

---

## Orchestrator protocol (short form)

1. Drop asks in `[[Inbox]]` as `- [ ]` checkboxes.
2. Claude scouts, classifies, and drafts an RFC or Plan — you'll see it appear in `RFCs/` or `Plans/` as `needs-review`.
3. Review the note. Set `status: [approved]` to execute, or `status: [changes-requested]` and write feedback under `## Review`.
4. Claude advances approved work, reports progress in today's `Status/` note, and flips done plans to `done`.

**You steer entirely through Obsidian. You never need to talk to Claude directly to advance work.**
