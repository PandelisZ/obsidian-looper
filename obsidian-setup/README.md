# Obsidian Setup for obsidian-looper

obsidian-looper uses Obsidian as its live brain: the user drops work into `Inbox.md`, the orchestrator reports back via `Status/` notes, and design decisions travel through a lightweight `RFC → Plan → approved` review cycle — all visible and editable in real-time inside Obsidian.

This guide wires up the two pieces that make it live: the **Local REST API plugin** (lets Claude write to your vault via MCP) and the **vault scaffold** (the folder structure the orchestrator expects).

---

## Step 1 — Install the Obsidian Local REST API plugin

1. Open Obsidian → **Settings → Community plugins → Browse**.
2. Search for **"Local REST API"** (by Adam Coddington).
3. Install and **Enable** it.
4. Go to **Settings → Local REST API**:
   - Note the **port** (default `27123`).
   - Copy the **API key** — you'll need it in Step 3.
   - Enable HTTPS or HTTP depending on your preference. HTTP is simpler locally.

---

## Step 2 — Set up mcp-obsidian in Claude Code

Add the Obsidian MCP server to your Claude Code config. Choose project-local (`.claude/mcp.json`) or global (`~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "mcp-obsidian"],
      "env": {
        "OBSIDIAN_API_KEY": "YOUR_API_KEY_HERE",
        "OBSIDIAN_HOST": "http://localhost:27123"
      }
    }
  }
}
```

Replace `YOUR_API_KEY_HERE` with the key from Step 1. If you used HTTPS and a custom port, adjust `OBSIDIAN_HOST`.

Verify the MCP is available in your next Claude Code session — the `obsidian_*` tools should appear.

---

## Step 3 — Scaffold the vault folder

1. Open your vault in Finder (or the file manager of your choice).
2. Copy the contents of `vault-scaffold/` from this repo into your vault under the folder name you chose in `project.config.js → obsidian.gigaFolder`.

   Example — if your vault is at `/Users/you/Documents/Obsidian/Notes` and `gigaFolder` is `My Project Giga`:
   ```
   cp -r vault-scaffold/ "/Users/you/Documents/Obsidian/Notes/My Project Giga/"
   ```

3. Obsidian will pick up the new files immediately (no restart needed).

---

## Step 4 — Enable the `status` List property type

The review cycle relies on `status` being a **List** property so Obsidian shows a chip-picker (the user selects `approved`, `changes-requested`, etc. by clicking).

Merge `types-patch.json` into your vault's `.obsidian/types.json`:

```bash
# Requires jq
jq -s '.[0] * .[1]' \
  "/path/to/your/vault/.obsidian/types.json" \
  "$(pwd)/types-patch.json" \
  > /tmp/types-merged.json \
  && mv /tmp/types-merged.json "/path/to/your/vault/.obsidian/types.json"
```

If `.obsidian/types.json` doesn't exist yet, just copy `types-patch.json` there directly:
```bash
cp types-patch.json "/path/to/your/vault/.obsidian/types.json"
```

Restart Obsidian after this change.

---

## Step 5 — Seed the status chips

Open `_status-options.md` in your new giga folder. It lists all valid status values. Obsidian reads this to populate the chip-picker for `status` List properties. You don't need to edit it — just make sure it's present.

---

## Step 6 — Start the loop

In a Claude Code session (with the skill installed and `project.config.js` filled in):

```
/loop /obsidian-looper run the continuous loop
```

Self-paced mode is recommended — the orchestrator ticks faster when work is in flight and slower when the inbox is quiet.

---

## Folder structure after setup

```
Your Vault/
└── My Project Giga/           ← your gigaFolder name
    ├── Home.md                ← dashboard + quick-reference protocol
    ├── Inbox.md               ← drop asks here as "- [ ] ..." items
    ├── Roadmap.md             ← rolling priorities
    ├── _status-options.md     ← seeds the status chip-picker
    ├── RFCs/
    │   └── _template.md
    ├── Plans/
    │   └── _template.md
    └── Status/
        └── _template.md
```

---

## Multi-project usage

You can run obsidian-looper across multiple repos from a single vault — just use a different `gigaFolder` name per project in each repo's `project.config.js`. Each project gets its own `Inbox`, `Plans`, and `Status` subtree.

For teams: commit `project.config.js` (it's not secret). Each developer sets `OBSIDIAN_LOOPER_VAULT_ROOT` to their local vault path, or edits `obsidian.vaultRoot` locally. The `gigaFolder` name should be the same for all developers so Obsidian note links resolve correctly.
