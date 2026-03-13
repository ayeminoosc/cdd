# Logi Agent Skill Ecosystem — Implementation Plan

## Mental Model

Each module (including the project root) is a **self-contained Logi workspace**: its config, rules, and hash state all live inside it. The skill is a single entry point that accepts an optional module path and delegates entirely to that module's local files.

```
project-root/              ← valid Logi workspace
  project.logi.jsonc
  logi.md
  .logi/hashes.json
  contracts/               ← .logi + .logid files

frontend/                  ← also a valid Logi workspace
  project.logi.jsonc
  logi.md
  .logi/hashes.json
  contracts/
```

---

## Commands

```
/logi build                    →  baseDir = ./
/logi status                   →  baseDir = ./
/logi reverse [outputFile]     →  baseDir = ./
/logi init                     →  scaffold baseDir = ./

/logi frontend build           →  baseDir = ./frontend/
/logi frontend status          →  baseDir = ./frontend/
/logi frontend reverse [file]  →  baseDir = ./frontend/
/logi frontend init            →  scaffold baseDir = ./frontend/
```

---

## Phase 1 — Per-Module Config Schema

**`project.logi.jsonc`** (lives in the module dir):
```jsonc
{
  "language": "typescript",        // translation target
  "framework": "react",
  "source": "contracts",           // dir containing .logi/.logid files (relative)
  "output": "src/generated"        // dir for generated code (relative)
}
```

**`logi.md`** (lives in the module dir) — standard sections:
- Target Stack
- File Organization (what files to generate per construct)
- Coding Conventions
- Per-Construct Rules (`type` → interface, `usecase` → service method, etc.)
- Patterns & Examples (paste existing code the LLM must follow)
- Do-Not list

---

## Phase 2 — `.logi/hashes.json` Schema (declaration-level)

```json
{
  "contracts/auth.logi": {
    "declarations": {
      "submit_login":  "<md5 of that block>",
      "login_form":    "<md5>",
      "login_screen":  "<md5>",
      "auth_flow":     "<md5>"
    },
    "last_translated": "2026-03-13T00:00:00.000Z",
    "outputs": {
      "src/generated/auth/AuthService.ts": "<md5>",
      "src/generated/auth/AuthTypes.ts":   "<md5>"
    }
  }
}
```

**Declaration hash** = MD5 of that block's text from its opening keyword to its matching `end`.

Six detectable states:

| State | Condition | Action |
|---|---|---|
| **Added** | File key missing from hashes | Translate all declarations |
| **New declaration** | File key exists, declaration name absent | Translate only new declarations |
| **Modified declaration** | Declaration hash differs | Send only changed block + referenced types to LLM for surgical update |
| **Deleted declaration** | Name in hashes, not in parsed file | LLM removes only that declaration's code from output |
| **Deleted file** | File key exists, file gone from disk | `delete` command returns output list → agent cleans up |
| **Drifted** | All declaration hashes match, but output file hash changed | Warn user: overwrite or run `reverse` first |

200 components, one changed line → only that one declaration block sent to the LLM.

---

## Phase 3 — `logi_utils.cjs`

File: `.agents/skills/logi/logi_utils.cjs`

**Key functions:**
- `resolveBaseDir(moduleArg)` — `moduleArg` given → `path.resolve(moduleArg)`, else `process.cwd()`
- `loadProjectConfig(baseDir)` — read + strip JSONC comments from `project.logi.jsonc`
- `parseLogiDeclarations(fileContent)` → `{ name: blockText }` map — parse top-level blocks by keyword+name…end
- `calculateHash(text)` — MD5 via Node `crypto`
- `loadHashes(baseDir)` / `saveHashes(baseDir, data)`
- `getDiff(baseDir)` → `{ added[], modified[], deleted[], unchanged[], drifted[] }` where `modified[]` entries include `{ file, changedDeclarations[], newDeclarations[], deletedDeclarations[] }`
- `recordTranslation(baseDir, logiFile, outputFiles)` — write updated entry to hashes
- `removeFromHashes(baseDir, logiFile)` → returns `outputs[]` list for the agent to delete

**CLI interface:**
```
node logi_utils.cjs status [module]
node logi_utils.cjs hash [module] <logiFile> <out1> [out2...]
node logi_utils.cjs delete [module] <logiFile>
node logi_utils.cjs reverse-lookup [module] <outputFile>
node logi_utils.cjs init [module]
```

---

## Phase 4 — `SKILL.md`

File: `.agents/skills/logi/SKILL.md`
YAML frontmatter: `compatibility: opencode`

**Argument parsing (first step of every handler):**
Split input: `logi [module] <command>`. If module given, `baseDir = ./<module>/`, else `baseDir = ./`.
Load `baseDir/project.logi.jsonc` → `language`, `framework`, `source`, `output`.
Load `baseDir/logi.md` → translation rules.

---

**`build` workflow:**

1. `node .agents/skills/logi/logi_utils.cjs status [module]` → parse diff output
2. **Deleted files** — for each: `node ... delete [module] <file>` → delete each listed output file from disk
3. **Drifted files** — for each: warn user which output files were manually edited; prompt: proceed (overwrite) or `reverse` first
4. **Added/modified files** — for each changed/new declaration:
   a. Extract just that declaration block from the `.logi` file
   b. Look up paired `.logid` file (same base name); extract matching-named block if present
   c. Identify referenced `type`/`failure` names within the declaration; read those blocks too
   d. Read `project.logi.jsonc` + `logi.md`
   e. If modified: read the *existing* output files (from `outputs` map) that contain this declaration
   f. Send to LLM: "here is the changed declaration + its dependencies + the existing output file(s) + rules — surgically update the output to reflect the change"
   g. Write updated output files
   h. Delete output files no longer in the new set
   i. `node ... hash [module] <logiFile> <out1> <out2>...`
5. Print summary

---

**`reverse [outputFile?]` workflow:**

Two detection modes run in one pass:
- **Drift**: output file is tracked in `hashes.json` but content hash changed → update existing `.logi` declaration
- **Onboard**: output file is NOT in `hashes.json` → new code with no Logi source → generate new `.logi` block and register it

1. If `outputFile` given: `node ... reverse-lookup [module] <outputFile>`
   - Found in hashes → drift mode
   - Not found → onboard mode
   Else (no argument):
   - `node ... status [module]` → get `drifted` list
   - Scan `output` dir for files not tracked in `hashes.json` → `untracked` list
   - Process all drifted + untracked in one pass
2. **For each drifted file**: read output + `.logi` source → LLM updates existing declaration
3. **For each untracked file**: read output → LLM generates new declaration → ask user which `.logi` file to append to
4. Show combined diff for all changes; single user confirmation before writing
5. Write all `.logi` updates
6. Drifted: `node ... hash [module] <logiFile>` — updates source hashes, keeps output map
7. Untracked: `node ... hash [module] <logiFile> <outputFile>` — registers new mapping

---

**`status` workflow:**
- `node ... status [module]`
- Display table: File | Declaration | Status | Last Translated | Note

---

**`init` workflow:**
1. Resolve `baseDir`
2. Create `baseDir/project.logi.jsonc` from template (prompt for language, framework, source, output)
3. Create `baseDir/logi.md` from template with all standard sections
4. Create `baseDir/.logi/hashes.json` as `{}`
5. Print VS Code extension install reminder

---

## Phase 5 — Multi-Agent Compatibility

- **OpenCode** — `compatibility: opencode` frontmatter; invoke: `opencode run --file .agents/skills/logi/SKILL.md "build"` or `"frontend build"`
- **GitHub Copilot** — `.github/instructions/logi.instructions.md` with `applyTo: **/*.logi`
- **Claude Code CLI** — "Logi Skill" section added to root `CLAUDE.md`

---

## Phase 6 — Installation

### One-line install (local project):
```bash
curl -fsSL https://raw.githubusercontent.com/ayeminoosc/cdd/main/.agents/skills/logi/install.sh | bash
```

### Install to global skill dir:
```bash
curl -fsSL https://raw.githubusercontent.com/ayeminoosc/cdd/main/.agents/skills/logi/install.sh | bash -s -- --global
```

`install.sh` always overwrites existing files (acts as update). Local installs to `./.agents/skills/logi/`, global installs to `~/.logi/skills/`.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `.agents/skills/logi/SKILL.md` | Overwrite (currently empty placeholder) |
| `.agents/skills/logi/logi_utils.cjs` | Create new |
| `.agents/skills/logi/install.sh` | Create new |
| `.agents/skills/logi/SETUP.md` | Create new |
| `CLAUDE.md` | Add Logi Skill section |
| `.github/instructions/logi.instructions.md` | Create new |

---

## Out of Scope (initial release)

- Colocated `.logi` files next to source (centralized `contracts/` dir only)
- Auto-merge when both source and code diverged simultaneously
- Test generation as a first-class command (can be done via `logi.md` rules)
- Sub-module nesting within a module's `project.logi.jsonc`
