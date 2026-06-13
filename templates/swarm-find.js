export const meta = {
  name: 'swarm-find',
  description: 'Multi-modal finder swarm: N blind searchers each hunt a different way, then dedup into one map',
  phases: [
    { title: 'Search', detail: 'one Haiku/Explore finder per search angle', model: 'haiku' },
    { title: 'Synthesize', detail: 'dedup + structure the combined findings' },
  ],
}

// args: a query string, e.g. "every database write in the billing subsystem".
// Each angle is BLIND to the others — diversity is the point; one angle never finds everything.
const QUERY = typeof args === 'string' ? args : (args && args.query) || 'the target pattern'

const ANGLES = [
  { key: 'by-symbol',  how: 'function/method/type names, call sites, definitions and references' },
  { key: 'by-path',    how: 'file names, directory structure, and naming conventions across subsystems' },
  { key: 'by-content', how: 'string literals, comments, config values, and inline usage' },
  { key: 'by-test',    how: 'test files, fixtures, and specs that exercise it (often name the real entrypoints)' },
]

const FINDING_SCHEMA = {
  type: 'object',
  required: ['hits'],
  properties: {
    hits: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'why'],
        properties: {
          path: { type: 'string', description: 'file path, with :line if known' },
          why:  { type: 'string', description: 'one line on why this matches the query' },
        },
      },
    },
  },
}

phase('Search')
const swarm = await parallel(ANGLES.map(a => () =>
  agent(
    `Search this repository for: ${QUERY}\n\n` +
    `Search ONLY via the "${a.key}" angle — ${a.how}. Ignore other angles; another searcher covers them.\n` +
    `Return every plausible hit. Prefer recall over precision; dedup is handled downstream.`,
    { label: `find:${a.key}`, phase: 'Search', model: 'haiku', agentType: 'Explore', schema: FINDING_SCHEMA }
  )
))

// Barrier is correct here: synthesis genuinely needs ALL angles at once to dedup across them.
const all = swarm.filter(Boolean).flatMap(r => r.hits)
const byPath = new Map()
for (const h of all) {
  const key = h.path.split(':')[0]
  if (!byPath.has(key)) byPath.set(key, { path: key, reasons: [] })
  byPath.get(key).reasons.push(h.why)
}
const deduped = [...byPath.values()]
log(`${all.length} raw hits across ${ANGLES.length} angles → ${deduped.length} unique files`)

phase('Synthesize')
const map = await agent(
  `Query: ${QUERY}\n\nDeduplicated candidate files (with reasons each angle flagged them):\n` +
  JSON.stringify(deduped, null, 2) +
  `\n\nProduce a clean map of where "${QUERY}" actually lives. Group by subsystem. ` +
  `Drop false positives, note the canonical entrypoint(s), and flag anything uncertain.`,
  { label: 'synthesize-map', phase: 'Synthesize' }
)

return { query: QUERY, uniqueFiles: deduped.length, map }
