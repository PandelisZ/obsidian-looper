import config from '../project.config.js'

export const meta = {
  name: 'inbox-drain',
  description: 'One pass over the Obsidian Inbox: extract open items, scout each in the repo, classify + draft — read-only, never mutates',
  phases: [
    { title: 'Read', detail: 'pull unchecked Inbox items' },
    { title: 'Scout', detail: 'one Haiku/Explore scout per item locates relevant code', model: 'haiku' },
    { title: 'Triage', detail: 'Sonnet classifies each item + drafts the RFC/Plan body', model: 'sonnet' },
  ],
}

// Read-only by design: this fans out research and drafting. It NEVER edits the repo or commits.
// The orchestrator persists the drafts into the vault (status: needs-review) and the user gates execution.
//
// args (all optional): { items: [{id, text}], inboxPath: string }
// If items are omitted, an agent extracts them from the Inbox file directly.
const INBOX = (args && args.inboxPath) || config.obsidian.inboxPath

const ITEMS_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'text'],
        properties: {
          id:   { type: 'string', description: 'short stable slug for the item' },
          text: { type: 'string' },
        },
      },
    },
  },
}

const TRIAGE_SCHEMA = {
  type: 'object',
  required: ['kind', 'summary', 'subsystems', 'readOnly'],
  properties: {
    kind: { type: 'string', enum: ['trivial-do-now', 'research', 'rfc-worthy', 'plan-ready', 'question-for-you'] },
    summary: { type: 'string', description: 'one-paragraph restatement of the ask + recommendation' },
    subsystems: { type: 'array', items: { type: 'string' }, description: 'affected subsystems' },
    readOnly: { type: 'boolean', description: 'true if no repo mutation is needed to act' },
    draftType: { type: 'string', enum: ['rfc', 'plan', 'none'] },
    draftMarkdown: { type: 'string', description: 'ready-to-save note body (frontmatter + sections) when draftType != none' },
    needsUser: { type: 'string', description: 'a decision to put to the user, or empty' },
  },
}

const subsystemNames = (config.subsystems || []).map(s => s.name).join(', ') || 'the project subsystems'
const guardrailsText = (config.guardrails || []).join('\n')
const GUARDRAILS = guardrailsText
  ? `Project guardrails:\n${guardrailsText}`
  : ''

phase('Read')
let items = (args && Array.isArray(args.items) && args.items) || null
if (!items) {
  const extracted = await agent(
    `Read the file at ${INBOX}. Under the "## Open" heading, return every UNCHECKED "- [ ]" ` +
    `checkbox item as {id, text} (id = a short kebab slug of the text). ` +
    `Ignore checked items and anything under "## Handled".`,
    { label: 'read-inbox', phase: 'Read', model: 'haiku', schema: ITEMS_SCHEMA }
  )
  items = (extracted && extracted.items) || []
}
log(`inbox: ${items.length} open item(s)`)
if (!items.length) return { drained: 0, items: [] }

// Pipeline: each item is scouted then triaged independently — fast items don't wait on slow ones.
const triaged = await pipeline(
  items,
  // Scout: locate the relevant code so triage is grounded, not guessed. Read-only.
  item => agent(
    `Inbox idea: "${item.text}"\n\nScout the repository for everything relevant to acting on this: ` +
    `which subsystems (${subsystemNames}), ` +
    `the key files/entrypoints, existing patterns to reuse, and any obvious risks. Do NOT edit anything.`,
    { label: `scout:${item.id}`, phase: 'Scout', model: 'haiku', agentType: 'Explore' }
  ),
  // Triage + draft: classify and, when warranted, produce a ready-to-save RFC/Plan body.
  (scoutNotes, item) => agent(
    `Inbox idea: "${item.text}"\n\nScout findings:\n${scoutNotes}\n\n` +
    (GUARDRAILS ? `${GUARDRAILS}\n\n` : '') +
    `Classify this item and, if it warrants an RFC or Plan, draft the full note body ` +
    `(YAML frontmatter with type/status: draft/subsystems/tags, then the standard sections). ` +
    `Set readOnly correctly. Surface any decision the user must make. Do NOT edit the repo.`,
    { label: `triage:${item.id}`, phase: 'Triage', model: 'sonnet', schema: TRIAGE_SCHEMA }
  ).then(t => ({ ...item, ...t }))
)

const results = triaged.filter(Boolean)
const needsUser = results.filter(r => r.needsUser)
log(`triaged ${results.length} item(s); ${needsUser.length} need a user decision`)

// Orchestrator takes it from here: save draftMarkdown into the vault's RFCs|Plans as needs-review,
// move handled items in Inbox.md to ## Handled with links, and only dispatch MUTATING work for
// items linked to an already-approved Plan.
return { drained: results.length, items: results }
