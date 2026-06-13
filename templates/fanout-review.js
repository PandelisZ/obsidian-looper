import config from '../project.config.js'

export const meta = {
  name: 'fanout-review',
  description: 'Review changed files across dimensions, then adversarially verify each finding before it survives',
  phases: [
    { title: 'Review', detail: 'one Sonnet reviewer per dimension', model: 'sonnet' },
    { title: 'Verify', detail: 'multi-vote skeptics try to refute each finding' },
  ],
}

// args: array of file paths to review. Omit → review the current git diff.
const TARGET = Array.isArray(args) && args.length
  ? `these files: ${args.join(', ')}`
  : 'the current uncommitted git diff (run `git diff` / `git status` to scope it)'

// Project guardrails become their own review dimension if configured.
const guardrailsText = (config.guardrails || []).join('\n')
const projectRulesPrompt = guardrailsText
  ? `project-rules: ${guardrailsText}`
  : 'project conventions: check for any obvious deviations from the patterns in the surrounding code'

const DIMENSIONS = [
  { key: 'correctness', prompt: 'logic errors, wrong conditionals, off-by-one, unhandled nulls/errors, broken control flow' },
  { key: 'security',    prompt: 'injection, authz gaps, unsafe deserialization, secret leakage, missing validation' },
  { key: 'project-rules', prompt: projectRulesPrompt },
  { key: 'reuse',       prompt: 'duplicated logic, reinvented utilities, needless complexity that an existing helper covers' },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'file', 'detail'],
        properties: {
          title:  { type: 'string' },
          file:   { type: 'string', description: 'path:line' },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['refuted', 'reason'],
  properties: {
    refuted: { type: 'boolean', description: 'true if this finding is NOT a real issue' },
    reason:  { type: 'string' },
  },
}

// Pipeline, not barrier: each dimension's findings verify as soon as that review finishes —
// dimension `security` doesn't wait for `reuse` to complete.
const reviewed = await pipeline(
  DIMENSIONS,
  d => agent(
    `Review ${TARGET}.\nLook ONLY for ${d.key} issues: ${d.prompt}.\n` +
    `Report concrete, located findings. Skip style nits and speculation.`,
    { label: `review:${d.key}`, phase: 'Review', model: 'sonnet', schema: FINDINGS_SCHEMA }
  ),
  (review, dim) => parallel((review.findings || []).map(f => () =>
    // 3 independent skeptics, each prompted to REFUTE. Default to refuted when uncertain.
    parallel(Array.from({ length: 3 }, (_, i) => () =>
      agent(
        `A ${dim.key} reviewer claims:\nTitle: ${f.title}\nFile: ${f.file}\nDetail: ${f.detail}\n\n` +
        `Try to REFUTE it. Read the actual code. If it's not clearly a real, reachable issue, set refuted=true. ` +
        `Skeptic #${i + 1}: default to refuted when uncertain.`,
        { label: `verify:${dim.key}`, phase: 'Verify', model: 'sonnet', schema: VERDICT_SCHEMA }
      )
    )).then(votes => {
      const survives = votes.filter(Boolean).filter(v => !v.refuted).length >= 2 // majority must NOT refute
      return { ...f, dimension: dim.key, confirmed: survives }
    })
  ))
)

const confirmed = reviewed.flat().filter(Boolean).filter(f => f.confirmed)
log(`${confirmed.length} findings survived adversarial verification`)
return { confirmed }
