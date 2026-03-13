# Logi — Setup Guide

## What is Logi?

Logi is a platform-agnostic DSL for describing software systems (types, usecases, widgets, screens, flows). An LLM-powered translator converts `.logi` files into idiomatic code in your target language and framework. Think of it as a contract layer between human intent and implementation.

- `.logi` — logic, data, and behavior
- `.logid` — visual design (paired with `.logi` by name)
- `project.logi.jsonc` — workspace config (language, framework, source/output dirs)
- `logi.md` — translation rules the LLM must follow
- `.logi/hashes.json` — change tracking state (commit this to git)

---

## Install the Skill

### One-line install (into current project):
```bash
curl -fsSL https://raw.githubusercontent.com/ayeminoosc/cdd/main/.agents/skills/logi/install.sh | bash
```

### Global install (available to all projects):
```bash
curl -fsSL https://raw.githubusercontent.com/ayeminoosc/cdd/main/.agents/skills/logi/install.sh | bash -s -- --global
```

### Install a specific version/tag:
```bash
curl -fsSL https://raw.githubusercontent.com/ayeminoosc/cdd/main/.agents/skills/logi/install.sh | bash -s -- --ref v1.2.0
```

Running the install command again always updates to the latest version.

> **Windows users:** Use [Git Bash](https://git-scm.com/downloads) (bundled with Git for Windows 2.x). The same `curl | bash` command works without modification. PowerShell is not supported.

---

## Install the VS Code Extension

Download the latest `.vsix` from [Releases](https://github.com/ayeminoosc/cdd/releases), then:

```bash
code --install-extension logi-*.vsix
```

Or search for **"Logi"** in the VS Code Extensions panel if it is published to the marketplace.

The extension provides:
- Syntax highlighting for `.logi` and `.logid`
- Auto-formatting on save
- Go-to-definition for references

---

## Fresh Project Setup

```bash
# 1. Install skill files
curl -fsSL https://raw.githubusercontent.com/ayeminoosc/cdd/main/.agents/skills/logi/install.sh | bash

# 2. Initialize root workspace
node .agents/skills/logi/logi_utils.cjs init

# 3. (Optional) Initialize sub-modules
node .agents/skills/logi/logi_utils.cjs init frontend
node .agents/skills/logi/logi_utils.cjs init backend
```

This creates in each initialized directory:

| File | Purpose |
|---|---|
| `project.logi.jsonc` | Language, framework, source dir, output dir |
| `logi.md` | Translation rules for the LLM |
| `.logi/hashes.json` | Change tracking state |

Edit `project.logi.jsonc` and `logi.md`, then write `.logi` contracts and run `/logi build`.

---

## Existing Project Setup

Two adoption strategies:

### Strategy A — Forward (start fresh for new features)
1. Run `curl ... | bash` to install skill
2. Run `node .agents/skills/logi/logi_utils.cjs init [module]`
3. Edit config and rules
4. Write `.logi` files for new features going forward
5. Legacy code stays untouched; Logi covers only new work

### Strategy B — Reverse-adopt (capture existing code in Logi)
1. Install skill and init workspace (steps A.1–A.3)
2. Ask your LLM: *"Read `src/auth/AuthService.ts` and write a `.logi` file in `contracts/` that describes what this code does"*
3. Run `/logi reverse` — this reads your code, produces a `.logi` that reflects it, shows a diff, and waits for your confirmation before writing
4. Run `/logi build` to verify the round-trip is clean

---

## Commands

All commands run from the **project root**.

```bash
# root workspace
/logi build                  # translate changed .logi files
/logi status                 # show what has changed
/logi reverse [outputFile]   # sync .logi back from manually edited code
/logi init                   # scaffold root workspace

# module workspace
/logi frontend build
/logi frontend status
/logi frontend reverse src/generated/auth/AuthService.ts
/logi frontend init
```

### Invocation by agent runtime

**OpenCode:**
```bash
opencode run --file .agents/skills/logi/SKILL.md "build"
opencode run --file .agents/skills/logi/SKILL.md "frontend build"
```

**GitHub Copilot (VS Code):**
Open agent mode, type: `/logi build`
(Requires `.github/instructions/logi.instructions.md` — see below)

**Claude Code CLI:**
From `CLAUDE.md` slash command: `/logi build`

---

## `project.logi.jsonc` Reference

```jsonc
{
  // Translation target
  "language": "typescript",   // typescript | java | python | swift | kotlin | go

  // Framework hint for the LLM
  "framework": "react",       // react | vue | next | spring | fastapi | express | native

  // Directory containing .logi and .logid contracts (relative to this file)
  "source": "contracts",

  // Directory where generated code will be written (relative to this file)
  "output": "src/generated"
}
```

---

## `logi.md` Reference

Standard sections — fill in all of them for best translation quality:

```markdown
## Target Stack
TypeScript 5, React 18, Vite, TailwindCSS v3

## File Organization
- type / failure  → src/generated/types/<Name>.ts
- usecase         → src/generated/usecases/<Name>.ts
- widget / screen → src/generated/components/<Name>.tsx
- flow            → src/generated/router/index.ts

## Coding Conventions
- PascalCase for component names; camelCase for functions/variables
- Use @/ path alias for imports inside src/
- Always async/await — no raw Promises
- Strict TypeScript — no `any`

## Per-Construct Rules
type    → TypeScript interface (readonly fields)
failure → class extending Error with typed message and fields
usecase → async exported function, validate inputs first
widget  → React FC with Props interface, Tailwind styling
screen  → React page registered in router, useLogiState hook
flow    → React Router v6 RouteObject[]

## Patterns & Examples
[paste actual code from your project here]

## Do-Not List
- No class components
- No CSS modules — Tailwind only
- No relative imports outside src/
```

---

## Git Workflow

```
✓ Commit these:
  project.logi.jsonc
  logi.md
  .logi/hashes.json      ← state file, NOT a build artifact
  contracts/*.logi
  contracts/*.logid
  src/generated/**       ← generated output (same as CDD)

✗ Do NOT gitignore:
  .logi/                 ← this is your source-of-truth for change tracking
```

---

## How Change Detection Works

`hashes.json` tracks hashes at **declaration level** — each `type`, `usecase`, `widget`, etc. block has its own MD5 hash.

| Status | Meaning |
|---|---|
| `ADDED` | New `.logi` file, never translated |
| `NEW` | New declaration added to an existing file |
| `MODIFIED` | One declaration changed — only that block sent to LLM |
| `DELETED` | Declaration removed — corresponding code removed from output |
| `FILE DEL` | Entire `.logi` file deleted — all its outputs cleaned up |
| `DRIFTED` | Source unchanged, but output file was manually edited |

200 components, one changed line → only that block goes to the LLM. Everything else is untouched.

---

## Troubleshooting

**"project.logi.jsonc not found"**
→ Run `node .agents/skills/logi/logi_utils.cjs init [module]`

**"Output files for X were manually edited"** (drift warning)
→ Run `/logi reverse` to sync `.logi` back from your code, then build again

**Hashes look wrong after manual file operations**
→ Delete `.logi/hashes.json` and run `/logi build` — everything will be treated as new and fully retranslated

**Node.js not available**
→ The skill works without `logi_utils.cjs` if the agent can read/write JSON directly, but the CLI is strongly recommended for accuracy
