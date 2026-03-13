#!/usr/bin/env bash
# Logi Skill Installer
# Downloads SKILL.md, logi_utils.cjs, and SETUP.md from the official repo.
# Always overwrites existing files (acts as update).
#
# Usage:
#   Local install (into current project):
#     curl -fsSL https://raw.githubusercontent.com/ayeminoosc/cdd/main/.agents/skills/logi/install.sh | bash
#
#   Global install:
#     curl -fsSL https://raw.githubusercontent.com/ayeminoosc/cdd/main/.agents/skills/logi/install.sh | bash -s -- --global
#
#   Specific branch/tag:
#     curl -fsSL https://raw.githubusercontent.com/ayeminoosc/cdd/main/.agents/skills/logi/install.sh | bash -s -- --ref v1.2.0

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/ayeminoosc/cdd"
REF="main"
GLOBAL=false
SKILL_FILES=("SKILL.md" "logi_utils.cjs" "SETUP.md" "install.sh")

# ── Parse flags ────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --global)  GLOBAL=true; shift ;;
    --ref)     REF="$2"; shift 2 ;;
    --ref=*)   REF="${1#--ref=}"; shift ;;
    -h|--help)
      echo "Usage: install.sh [--global] [--ref <branch|tag|sha>]"
      echo "  --global   Install to ~/.logi/skills/ (available to all projects)"
      echo "  --ref      Git ref to download from (default: main)"
      exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

# ── Resolve install directory ───────────────────────────────────────────────
if [[ "$GLOBAL" == true ]]; then
  INSTALL_DIR="$HOME/.logi/skills"
else
  INSTALL_DIR=".agents/skills/logi"
fi

BASE_URL="$REPO_RAW/$REF/.agents/skills/logi"

echo ""
echo "Installing Logi skill from ayeminoosc/cdd@$REF"
echo "  Target: $INSTALL_DIR"
echo ""

# ── Download files ──────────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"

for file in "${SKILL_FILES[@]}"; do
  url="$BASE_URL/$file"
  dest="$INSTALL_DIR/$file"
  tmpfile=$(mktemp)
  if curl -fsSL "$url" -o "$tmpfile"; then
    mv "$tmpfile" "$dest"
    echo "  ✓  $file"
  else
    rm -f "$tmpfile"
    echo "  ✗  $file  (download failed — check network or ref)" >&2
    exit 1
  fi
done

# Make install.sh executable
chmod +x "$INSTALL_DIR/install.sh" 2>/dev/null || true

echo ""
echo "Logi skill installed successfully."

# ── Post-install hints ──────────────────────────────────────────────────────
if [[ "$GLOBAL" == true ]]; then
  echo ""
  echo "Global install complete."
  echo "To use in a project, add this to your agent config or run:"
  echo "  opencode run --file ~/.logi/skills/SKILL.md \"build\""
else
  echo ""
  echo "Project install complete. Next steps:"
  echo ""
  echo "  1. Initialize a Logi workspace (one-time per module):"
  echo "     node .agents/skills/logi/logi_utils.cjs init"
  echo "     node .agents/skills/logi/logi_utils.cjs init frontend"
  echo ""
  echo "  2. Edit project.logi.jsonc — set language, framework, source, output"
  echo "  3. Edit logi.md — define translation rules"
  echo "  4. Write .logi contracts in your source dir"
  echo "  5. Run: /logi build"
  echo ""
  echo "  VS Code extension:"
  echo "  Download logi-*.vsix from https://github.com/ayeminoosc/cdd/releases"
  echo "  Then: code --install-extension logi-*.vsix"
fi
echo ""
