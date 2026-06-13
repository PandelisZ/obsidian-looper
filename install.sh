#!/usr/bin/env bash
# obsidian-looper installer
# Usage: ./install.sh /path/to/target-repo
#
# Copies the skill into the target repo's skill directories and drops a
# project.config.js stub if one doesn't already exist.
#
# After running, fill in project.config.js and follow obsidian-setup/README.md.

set -euo pipefail

TARGET=${1:?"Usage: ./install.sh /path/to/target-repo"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Validate target ────────────────────────────────────────────────────────────
if [ ! -d "$TARGET" ]; then
  echo "Error: target directory does not exist: $TARGET"
  exit 1
fi

# ── Create skill directories ───────────────────────────────────────────────────
AGENTS_SKILL="$TARGET/.agents/skills/obsidian-looper"
CLAUDE_SKILL="$TARGET/.claude/skills/obsidian-looper"

mkdir -p "$AGENTS_SKILL/templates"
mkdir -p "$CLAUDE_SKILL/templates"

echo "Installing obsidian-looper into $TARGET ..."

# ── Copy skill files ───────────────────────────────────────────────────────────
# We copy (not symlink) for portability. To stay in sync with upstream,
# re-run this script after pulling obsidian-looper updates.

cp "$SCRIPT_DIR/SKILL.md" "$AGENTS_SKILL/SKILL.md"
cp "$SCRIPT_DIR/SKILL.md" "$CLAUDE_SKILL/SKILL.md"

for tmpl in "$SCRIPT_DIR/templates/"*.js; do
  filename="$(basename "$tmpl")"
  cp "$tmpl" "$AGENTS_SKILL/templates/$filename"
  cp "$tmpl" "$CLAUDE_SKILL/templates/$filename"
done

# ── Drop config stub ───────────────────────────────────────────────────────────
CONFIG_DEST="$AGENTS_SKILL/project.config.js"
if [ -f "$CONFIG_DEST" ]; then
  echo "  project.config.js already exists — not overwriting."
else
  cp "$SCRIPT_DIR/project.config.example.js" "$CONFIG_DEST"
  cp "$SCRIPT_DIR/project.config.example.js" "$CLAUDE_SKILL/project.config.js"
  echo ""
  echo "  *** ACTION REQUIRED ***"
  echo "  Edit $CONFIG_DEST"
  echo "  Set your vault path, gigaFolder, subsystems, and any project guardrails."
  echo ""
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "Done. obsidian-looper installed into:"
echo "  $AGENTS_SKILL"
echo "  $CLAUDE_SKILL"
echo ""
echo "Next steps:"
echo "  1. Fill in project.config.js (vault path, subsystems, guardrails)"
echo "  2. Follow obsidian-setup/README.md to wire the Obsidian MCP and scaffold the vault"
echo "  3. Start a Claude Code session and run: /loop /obsidian-looper run the continuous loop"
