import config from '../project.config.js'

export const meta = {
  name: 'per-subsystem-migrate',
  description: 'Apply one instruction across configured subsystems in parallel, each in an isolated worktree, each verified',
  phases: [
    { title: 'Apply', detail: 'worktree-isolated Sonnet implementer per subsystem', model: 'sonnet' },
    { title: 'Verify', detail: "run each subsystem's own scoped check" },
  ],
}

// args: { instruction: string, subsystems: string[] }
// e.g. { instruction: "rename User.name to User.display_name", subsystems: ["backend", "frontend"] }
// Subsystem names must match entries in project.config.js → subsystems[].name
const INSTRUCTION = (args && args.instruction) || 'apply the requested change'
const REQUESTED = (args && args.subsystems) || []

// Build the verify map from project config
const SUBSYSTEM_MAP = Object.fromEntries(
  (config.subsystems || []).map(s => [s.name, s])
)
const VERIFY = Object.fromEntries(
  (config.subsystems || []).map(s => [s.name, s.verifyCmd])
)

// Project guardrails — prepended to every implementer prompt
const GUARDRAILS = (config.guardrails || []).length
  ? 'PROJECT GUARDRAILS (follow strictly):\n' + config.guardrails.map(g => `- ${g}`).join('\n')
  : ''

const targets = REQUESTED.filter(s => {
  if (VERIFY[s]) return true
  log(`SKIPPED unknown subsystem "${s}" — not in project.config.js subsystems`)
  return false
})
log(`Migrating ${targets.length} subsystem(s): ${targets.join(', ')}`)

const RESULT_SCHEMA = {
  type: 'object',
  required: ['summary', 'filesChanged'],
  properties: {
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
  },
}
const VERIFY_SCHEMA = {
  type: 'object',
  required: ['passed', 'output'],
  properties: {
    passed: { type: 'boolean' },
    output: { type: 'string', description: 'key lines of the verify command output' },
  },
}

// Pipeline: each subsystem flows apply → verify independently. Worktree isolation lets the
// Apply stages mutate files in parallel without colliding (expensive but necessary here).
const results = await pipeline(
  targets,
  sub => agent(
    `In the "${SUBSYSTEM_MAP[sub].path}" subsystem (${SUBSYSTEM_MAP[sub].stack}), apply this change:\n\n` +
    `${INSTRUCTION}\n\n` +
    (GUARDRAILS ? `${GUARDRAILS}\n\n` : '') +
    `Make the edits. Do NOT run the verify command — a separate stage does that. Report a summary and the files you changed.`,
    { label: `apply:${sub}`, phase: 'Apply', model: 'sonnet', isolation: 'worktree', schema: RESULT_SCHEMA }
  ),
  (applied, sub) => agent(
    `Run the verification for the "${sub}" subsystem:\n\`${VERIFY[sub]}\`\n\n` +
    `Changes applied: ${applied ? applied.summary : '(apply stage failed)'}\n` +
    `Report whether it passed and the key output lines.`,
    { label: `verify:${sub}`, phase: 'Verify', model: 'sonnet', schema: VERIFY_SCHEMA }
  ).then(v => ({ subsystem: sub, applied, verify: v }))
)

const final = results.filter(Boolean)
const green = final.filter(r => r.verify && r.verify.passed).map(r => r.subsystem)
const red = final.filter(r => !r.verify || !r.verify.passed).map(r => r.subsystem)
const dropped = targets.filter(s => !final.some(r => r.subsystem === s)) // apply threw → dropped to null
log(`green: ${green.join(', ') || 'none'} | red: ${red.join(', ') || 'none'} | dropped: ${dropped.join(', ') || 'none'}`)

return { instruction: INSTRUCTION, green, red, dropped, results: final }
