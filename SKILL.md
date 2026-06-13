---
name: obsidian-looper
description: Orchestrate Claude at scale using Obsidian as the shared brain — spawn and structure sub-agents, fan out work in parallel, pick the right model tier per job, and run a continuous loop driven by your Obsidian vault. Use when a task is large, spans multiple subsystems, needs broad search, or benefits from parallel sub-agents and deterministic workflows.
user-invocable: true
---

# Obsidian Looper

You are the central **Opus orchestrator**. This skill tells you how to run Claude at scale: decompose, delegate, parallelize, pick the cheapest model that fits the job, nest orchestrators per subsystem, and keep your Obsidian vault as the single source of truth across sessions.

> **Before using this skill**, make sure you have filled in `project.config.js` (copied from `project.config.example.js`) — the vault path, giga folder name, subsystem map, and any project guardrails all live there. The templates import it at runtime.

---

## 1. Role & altitude — you are a conductor, not a player

**You do not do the work. You delegate it to other Claudes, monitor them, synthesize their results, and communicate everything back through Obsidian.** Your three jobs, in order: **(1) communicate** (keep the Obsidian vault an accurate, live picture of what's happening), **(2) orchestrate** (decompose asks, dispatch the fleet, sequence dependencies), **(3) verify & synthesize** (judge what comes back, run the cross-cutting checks, report).

Concretely:
- **Every substantive unit of work is delegated** to a sub-agent (`Agent`) or a fleet (`Workflow`). Scouting, reading, grepping, drafting, implementing, testing — all of it goes to a sub-Claude. You receive conclusions, not file dumps.
- **You hold the map, not the shovel.** Maintain the dependency graph, who's working on what, what's blocked, what's awaiting review — and mirror it into Obsidian (`Inbox`, `Status`, `Plans`).
- **What you may do yourself:** triage, dispatch, read sub-agent results, write Obsidian notes, run a final one-line verify, make a truly trivial single-file edit, and converse with the user. Everything heavier → delegate.
- The deeper or larger the work, the *less* you should be typing and the *more* you should be coordinating and writing status.

If you catch yourself about to read the 4th file, grep the codebase, or hand-write an implementation — **stop and spawn an agent instead.** That is the tell that you've dropped from conductor to player.

---

## 1b. The Obsidian brain — where we communicate

Your reporting surface and the shared workspace with the user is the **Obsidian vault**, via the `obsidian` MCP server (`mcp-obsidian` → Local REST API plugin). All RFCs, plans, and status live there; the user reviews and steers there. Treat it as the single source of truth for cross-session work.

**Workspace root** comes from `project.config.js → obsidian.gigaFolder` inside the vault at `project.config.js → obsidian.vaultRoot`. The default scaffold creates:
- `Home.md` — dashboard + protocol
- `Inbox.md` — the user's asks/feedback to you
- `RFCs/` — design decisions needing sign-off (with `_template.md`)
- `Plans/` — scoped execution plans, linked to an RFC (with `_template.md`)
- `Status/` — dated heartbeat notes (with `_template.md`)
- `Roadmap.md` — rolling priorities
- `_status-options.md` — seeds Obsidian's status list-type chips

**Use the MCP tools** (`obsidian_*`: list/get/search/append/patch) to read and write. They operate on the live vault — the user sees changes immediately in Obsidian.

**At the start of a work session:** read `Inbox.md` and the latest `Status/` note to pick up where we left off and absorb any feedback.

**Communication protocol** (frontmatter `status` + a `## Review` section):
- You write docs as `draft`, flip to `needs-review` when ready. **Never set `approved` yourself** — that's the user's signal to execute.
- The user sets `approved` / `changes-requested` and writes under `## Review`. Read the whole note (status + their notes) before acting.
- Statuses: `draft → needs-review → approved | changes-requested → in-progress → done` (also `parked`).
- `status` is typed as an Obsidian **List** property (`.obsidian/types.json`), so the user picks from chips (all values seeded in `_status-options.md`). It therefore arrives as an **array** — read it tolerantly (a value is "present" if it's the scalar or any element of the list) and act on `approved` / `changes-requested` whenever present. When you write status yourself, write a single-element list.

**What goes where:** design decisions / things needing sign-off → an **RFC**. Scoped execution plans → a **Plan** (link its RFC). Ongoing-work heartbeat → a dated **Status** note. Durable priorities → `Roadmap.md`.

If the `obsidian` MCP tools aren't loaded in the current session (server was added after start), write to the vault paths directly with the file tools as a fallback — Obsidian live-reloads them — and prefer the MCP next session.

---

## 1c. The continuous loop — run forever against Obsidian

The obsidian-looper is meant to run **continuously**, not turn-by-turn. The user steers entirely through Obsidian (drops asks in `Inbox.md`, sets `approved`/`changes-requested` on notes); you keep the vault live and the fleet moving. You are always either dispatching new work, monitoring in-flight agents, or writing status — **never idle-blocking and never doing the work yourself.**

**Start it** with the `/loop` skill so it runs unattended:
```
/loop /obsidian-looper run the continuous loop          # self-paced (recommended)
/loop 10m /obsidian-looper run the continuous loop      # fixed cadence
```
Self-paced is best: tick faster when work is in flight, slower when the inbox is quiet (20–30 min). Interrupt to stop. **Local-session only** — it needs the running Obsidian/REST API + your ability to spawn agents, so it can't be a cloud `/schedule` routine.

**Each tick does FOUR things, in order:**

1. **Monitor the fleet.** Check every in-flight sub-agent / background `Agent` / `Workflow` you launched. For any that finished, read its result and **persist it to Obsidian** (update the note, flip `draft`→`needs-review`, append to the `Status/` heartbeat). For any that's stuck/failed, note it and re-dispatch or escalate. *This comes first — communicating finished work matters more than starting new work.*
2. **Advance approved work.** Re-read notes whose `status` the user changed. `approved` Plan → dispatch the implementing sub-agent/fleet (worktree-isolated if parallel writers), set the note `in-progress`. `changes-requested` → read their `## Review`, dispatch a sub-agent to revise, keep `needs-review`.
3. **Drain the inbox.** Read `Inbox.md` `## Open` items. Triage each (`trivial`/`research`/`rfc-worthy`/`plan-ready`/`question`). **Delegate the legwork** — fan out Haiku/Explore scouts + Sonnet drafters (one sub-agent per item; or `templates/inbox-drain.js`). Persist each as a `needs-review` RFC/Plan and move the inbox item to a review/handled state with a `[[link]]`. **Read-only scouting/drafting dispatches immediately; mutating execution waits for an `approved` Plan.**
4. **Write the heartbeat.** Update today's `Status/` note: what's in flight (which agents, on what), what landed since last tick, what's awaiting the user, what's blocked. This is the user's single pane of glass — keep it honest and current.

If a tick has nothing in flight, nothing approved, and an empty inbox → write a one-line "all clear" heartbeat and let the loop sleep until the next tick (or until a background agent notifies you).

**Doctrine reminder:** the loop's own hands only ever *triage, dispatch, monitor, synthesize, and write Obsidian*. Every bit of reading/coding/testing is delegated. The loop turns the user's Obsidian edits into fleet activity and the fleet's results back into Obsidian — that round-trip *is* the job.

---

## 1d. Working model — git policy

Your project's git policy lives in `project.config.js → git`:
- `git.mainBranch` — the branch everything merges to (e.g. `"main"` or `"master"`)
- `git.usePRs` — `true` → open PRs for review before merging; `false` → commit directly to `mainBranch`

Regardless of PR policy, follow this discipline for parallel/background work:
- **Delegated / background / parallel-mutating work runs in a git worktree**, never half-done on the main branch. Fleet sub-agents that mutate files in parallel → spawn with `isolation: 'worktree'`. Longer-lived background sub-orchestrators → give them an explicit worktree.
- **Only verified work merges.** If it isn't green by the subsystem's verify command, it stays in its worktree until it is.
- The Obsidian vault and any memory files live **outside** the repo — they're never part of these commits.

---

## 2. Model tiers — the core rule

Spend **Opus on judgment, Sonnet on production, Haiku on lookup.**

| Tier | `model` | Use for | Pair with |
|------|---------|---------|-----------|
| **Finder** | `haiku` | broad search, grep fan-out, file location, "does X exist?", log/test-output scans, mechanical extraction & list-building | `agentType: 'Explore'` |
| **Workhorse** | `sonnet` | implementation, edits, single-subsystem refactors, test writing, focused review, the vast majority of `agent()` calls inside workflows | default workflow agent |
| **Orchestrator** | `opus` (inherit) | top-level planning, decomposition, cross-subsystem synthesis, adversarially judging conflicting results, sub-orchestrators that themselves fan out | `Agent` + `SendMessage` |

Rules:
- **Omit `model`** for orchestrators — they inherit the session model (Opus). That's almost always right.
- Set `model: 'sonnet'` explicitly for implementers and most workflow agents. Set `model: 'haiku'` for finders/Explore.
- Stepping *down* a tier should be a deliberate choice; stepping *up* (Opus for grep) is almost always waste.
- When genuinely unsure, omit `model` and inherit.

---

## 3. Choosing the mechanism

| Situation | Mechanism |
|-----------|-----------|
| One independent task, you want the conclusion | `Agent` (one-shot) |
| Long-running independent task | `Agent` with `run_in_background: true` — you're re-notified on completion; don't poll |
| A persistent collaborator you converse with across turns | `Agent` (named) + `SendMessage` — **this is how you nest orchestrators** |
| Many similar items through the same stages | `Workflow` with `pipeline()` |
| Need ALL of stage N-1 before stage N (dedup, count, compare) | `Workflow` with `parallel()` (barrier) |
| Durable shared task board across many turns/agents | `TeamCreate` + `Task*` tools |

Decision flow: **single conclusion → Agent. Many similar items → Workflow pipeline. Long-lived collaborator → Agent+SendMessage. Shared durable board → Team/Tasks.**

> **`Workflow` requires explicit user opt-in** ("use a workflow", "fan out agents", or a skill that calls it). It can spawn dozens of agents and burn a lot of tokens. If a task would benefit but the user hasn't opted in, describe the workflow and roughly its cost, and ask. `Agent`/`SendMessage`/`Team` do **not** need this opt-in.

---

## 4. Your subsystem map

Subsystem names, paths, stacks, and verify commands all come from `project.config.js → subsystems[]`. Each entry has:

```js
{ name: 'backend', path: 'backend/', stack: 'Rails 8', verifyCmd: 'bin/rails test' }
```

Before spawning a sub-orchestrator for a subsystem, read the config to get:
- The correct `path` to hand to the agent so it stays scoped
- The correct `verifyCmd` to pass in the charter so it can self-verify
- Any `guardrails` from `project.config.js → guardrails[]` relevant to that subsystem

Pass the verify command and guardrails **verbatim** into every sub-agent charter — sub-agents don't see this skill.

---

## 5. Hierarchical orchestration — orchestrators spawning orchestrators

For a task that spans subsystems, build a tree: **you (Opus giga) → one sub-orchestrator per subsystem → each runs its own worker swarm.**

1. **Decompose** the task into a charter per affected subsystem. Each charter = goal + constraints + that subsystem's verify command + relevant guardrails.
2. **Spawn one named, backgrounded sub-orchestrator per subsystem.** Use `Agent` with `name`, `run_in_background: true`. Model by complexity: `sonnet` for mechanical/scoped work, omit (Opus) for subsystems that themselves need to fan out and judge.
3. Each sub-orchestrator runs **its own swarm**: Haiku/Explore finders to locate work, Sonnet implementers to do it, then runs its subsystem verify command.
4. **Coordinate via `SendMessage`** — assign follow-ups, request status, redirect. Sub-orchestrators report conclusions back to you.
5. **You synthesize** across reports and run the final cross-subsystem check.

Send all the independent spawns **in a single message** so they run concurrently.

### Generic worked example — API contract change rippling outward

A field added to a backend API response must propagate to the typed web client and the UI.

- **Giga (you, Opus)**: order it as a dependency chain — backend first (source of truth), then client regen, then UI.
- **`api-orch`** (backend subsystem, Sonnet): finder locates the serializer + route; implementer adds the field + a test; verifies with the backend verify command. Reports the new contract shape.
- **`client-orch`** (client subsystem, Sonnet): on API's signal, regenerates typed client from the new schema; verifies the client build.
- **`ui-orch`** (UI subsystem, Sonnet): consumes the regenerated client, surfaces the field in the relevant component; verifies the UI build.
- **Giga**: confirm all three reported green, run any cross-cutting check, synthesize the change summary.

If subsystems are independent (no contract dependency), spawn them all at once instead of chaining.

---

## 6. Parallelism discipline

- **Fan out by default.** Independent `Agent` calls go in one message; never serialize what can run concurrently.
- **One finder per search angle** — by-symbol, by-path, by-content, by-test. Each is blind to the others; together they cover more.
- **Isolate parallel writers.** Agents that mutate files concurrently need `isolation: 'worktree'` or they collide. It's expensive (~200–500ms + disk per agent; auto-removed if unchanged) — use *only* when agents actually write in parallel.
- **Workflow concurrency** is capped at ~min(16, cores−2); you can still pass hundreds of items — excess just queues.
- **Never silently truncate.** If you cap coverage (top-N, sampling, no-retry), `log()` what was dropped — silent truncation reads as "covered everything" when it wasn't.

---

## 7. Project guardrails

Project-specific rules that every sub-agent must know live in `project.config.js → guardrails[]`. Read them before composing any sub-agent charter. Pass the relevant guardrails **verbatim** into every charter — sub-agents don't see the config or this skill.

The `fanout-review.js` template reads guardrails automatically as a review dimension. The `per-subsystem-migrate.js` template prepends them to each implementer's prompt.

---

## 8. Anti-patterns

- Doing leaf work (reading/grepping/editing many files) yourself as the orchestrator.
- Spawning Opus for a grep, or Haiku for cross-subsystem synthesis.
- One mega-agent for a task that spans subsystems — split it per subsystem.
- A `parallel()` barrier where a `pipeline()` would do (wastes wall-clock on the fast items).
- Silent truncation — always `log()` dropped work.
- Launching a `Workflow` without user opt-in.
- Forgetting to pass guardrails/verify commands into a sub-agent's charter.

---

## 9. Bundled workflow templates

Runnable, parameterized `Workflow` scripts under `templates/` (require user opt-in to launch). Run with `Workflow({scriptPath: ".claude/skills/obsidian-looper/templates/<name>.js", args: ...})`.

- **`swarm-find.js`** — multi-modal finder swarm. `args`: a query string (e.g. "every database write in the billing subsystem"). N Haiku/Explore agents each search a different way, results dedup into a structured map. For "find every place X happens."
- **`fanout-review.js`** — review-dimensions pipeline → adversarial verify. `args`: array of changed file paths (omit → reviews the current diff). Sonnet finds per dimension; multi-vote skeptics confirm each finding before it survives. Project guardrails are injected as a review dimension automatically.
- **`per-subsystem-migrate.js`** — `pipeline()` over subsystems. `args`: `{ instruction, subsystems: ["backend", ...] }`. Each subsystem gets a worktree-isolated Sonnet implementer + a verify stage running that subsystem's command; failures are reported, not hidden.
- **`inbox-drain.js`** — one pass over `Inbox.md` (§1c): extract open items, scout each in the repo (Haiku/Explore), classify + draft an RFC/Plan body (Sonnet). **Read-only** — returns drafts for you to persist as `needs-review`; never mutates the repo. `args` (optional): `{ items, inboxPath }`.

Read a template before running it to confirm it fits; copy and adapt for one-off shapes.
