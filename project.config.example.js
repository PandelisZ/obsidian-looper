// obsidian-looper project configuration
// Copy this file to project.config.js (in the same directory as SKILL.md)
// and fill in the values for your repo before using the skill.
//
// project.config.js is safe to commit — it contains no secrets.
// For per-developer overrides (different vault path), use the
// OBSIDIAN_LOOPER_VAULT_ROOT environment variable.

export default {
  // ── Obsidian brain ─────────────────────────────────────────────────────────
  obsidian: {
    // Absolute path to the root of your Obsidian vault
    vaultRoot: process.env.OBSIDIAN_LOOPER_VAULT_ROOT || '/Users/you/Documents/Obsidian/Notes',

    // Folder name inside the vault that obsidian-looper owns.
    // It will contain: Home.md, Inbox.md, Roadmap.md, RFCs/, Plans/, Status/
    gigaFolder: 'My Project Giga',

    // Derived paths — leave these as-is (they read from the values above)
    get inboxPath() {
      return `${this.vaultRoot}/${this.gigaFolder}/Inbox.md`
    },
    get gigaRoot() {
      return `${this.vaultRoot}/${this.gigaFolder}`
    },
  },

  // ── Git policy ─────────────────────────────────────────────────────────────
  git: {
    // The primary branch all work targets (e.g. 'main' or 'master')
    mainBranch: 'main',

    // true  → open pull requests for review before merging
    // false → commit directly to mainBranch as you go
    usePRs: true,
  },

  // ── Subsystem map ───────────────────────────────────────────────────────────
  // One entry per independently-verifiable part of your repository.
  // The orchestrator passes `verifyCmd` verbatim to sub-agents so they can
  // self-verify before reporting success. Keep these scoped and fast.
  subsystems: [
    {
      name: 'backend',
      path: 'backend/',
      stack: 'Rails 8 (Ruby)',
      verifyCmd: 'bin/rails test',
    },
    {
      name: 'frontend',
      path: 'frontend/',
      stack: 'Next.js (TypeScript)',
      verifyCmd: 'pnpm build',
    },
    {
      name: 'mobile',
      path: 'mobile/',
      stack: 'Expo Router (React Native)',
      verifyCmd: 'pnpm type-check',
    },
    // Add more subsystems as needed:
    // { name: 'infra', path: 'infra/', stack: 'Terraform', verifyCmd: 'terraform validate' },
  ],

  // ── Project guardrails ──────────────────────────────────────────────────────
  // Plain-text rules injected verbatim into every sub-agent charter.
  // Sub-agents don't see this config or the skill, so spelling things out here
  // is the only way to enforce them consistently.
  //
  // Examples:
  guardrails: [
    // 'No raw SQL in ActiveRecord models — use scopes.',
    // 'Never commit .env files.',
    // 'All API endpoints must have request specs.',
  ],
}
