---
name: logi
description: Translate Logi DSL (.logi / .logid) files into target language implementations, detect changes at declaration level, handle deletions, drift detection, and reverse sync.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: code-generation
---

# Logi Translator Agent Skill

**AUTONOMOUS EXECUTION MODE**: Execute the requested command immediately. Do not ask for confirmation unless a drifted file requires a decision.

You are the Logi Translation Expert. Logi is a platform-agnostic DSL that describes software systems using types, failures, usecases, widgets, screens, flows, and jobs. Your role is to translate Logi declarations into idiomatic code in the target language and framework defined by the workspace config.

---

## Argument Parsing

The input will be one of:
- `build` → `baseDir = ./`
- `status` → `baseDir = ./`
- `reverse [outputFile]` → `baseDir = ./`
- `init` → `baseDir = ./`
- `<module> build` → `baseDir = ./<module>/`
- `<module> status` → `baseDir = ./<module>/`
- `<module> reverse [outputFile]` → `baseDir = ./<module>/`
- `<module> init` → `baseDir = ./<module>/`

Extract `baseDir` first. All subsequent paths are relative to `baseDir` unless stated otherwise.

---

## `build` Command

### Step 1 — Get Change Report
Run:
```
node .agents/skills/logi/logi_utils.cjs status [module]
```
Parse the `__JSON__` block from the output. This gives you:
```json
{
  "added":     ["contracts/auth.logi"],
  "modified":  [{ "file": "contracts/todo.logi", "changedDeclarations": ["submit_login"], "newDeclarations": [], "deletedDeclarations": [] }],
  "deleted":   [{ "file": "contracts/old.logi", "outputs": { "src/generated/Old.ts": "<hash>" } }],
  "unchanged": ["contracts/user.logi"],
  "drifted":   [{ "file": "contracts/auth.logi", "driftedOutputs": ["src/generated/auth/AuthService.ts"] }]
}
```

### Step 2 — Handle Deleted Files
For each entry in `deleted`:
1. Run `node .agents/skills/logi/logi_utils.cjs delete [module] <file>` — this removes the hash entry and prints the output files under `__OUTPUTS__`
2. Delete each listed output file from disk (confirm the path resolves under `baseDir`)

### Step 3 — Handle Drifted Files
For each entry in `drifted`:
- Notify the user: "Output files for `<file>` were manually edited: `<driftedOutputs>`"
- Ask: **overwrite** (proceed with translate) or **skip** (run `reverse` on this file first)?
- Only proceed with translation for files the user chose to overwrite.

### Step 4 — Load Workspace Config + Rules
Read:
- `<baseDir>/project.logi.jsonc` → get `language`, `framework`, `source`, `output`
- `<baseDir>/logi.md` → your translation rules — **follow them exactly**

### Step 5 — Translate Added Files
For each file in `added`:
1. Read the full `.logi` file content from `<baseDir>/<file>`
2. Read paired `.logid` file if it exists: same path but with `.logid` extension
3. Read `logi.md` rules
4. Identify all `type` and `failure` declarations referenced — include their blocks as context
5. **Generate all output files** for this file. Use `logi.md` File Organization rules to determine what files to create and where. The LLM decides exact file paths inside `output` dir.
6. Write each output file to disk
7. Run: `node .agents/skills/logi/logi_utils.cjs hash [module] <logiFile> <out1> [out2...]`

### Step 6 — Translate Modified Files (declaration-level, surgical)
For each entry in `modified`:

**For each declaration in `changedDeclarations` + `newDeclarations`:**
1. Extract just that declaration's block text from the `.logi` file (from keyword line to its `end`)
2. Identify `type`/`failure` names referenced inside this block; extract those blocks too
3. From paired `.logid` file (if exists), extract any block with matching name
4. Read `logi.md` rules
5. From the hash store output map for this file, identify which output files are affected by this declaration
6. Read the current content of those output files (surgical update context)
7. Send to LLM with this prompt structure:

   > **Changed Logi declaration:**
   > ```logi
   > <block text>
   > ```
   > **Referenced types:**
   > ```logi
   > <type/failure blocks>
   > ```
   > **Current output file** (`<path>`):
   > ```<language>
   > <current file content>
   > ```
   > **Translation rules** (`logi.md`):
   > ```
   > <logi.md content>
   > ```
   > Task: Surgically update the output file to reflect the changed declaration. Preserve all other declarations in the file. Follow logi.md rules exactly. Return the complete updated file content.

8. Write the updated output file(s)

**For each declaration in `deletedDeclarations`:**
1. Read current output files for this `.logi` source
2. Instruct LLM to remove only the code corresponding to the deleted declaration
3. Write updated output files

After handling all declarations for a file:
- Delete any output files that are no longer needed
- Run: `node .agents/skills/logi/logi_utils.cjs hash [module] <logiFile> <out1> [out2...]`

### Step 7 — Summary
Print a summary:
```
Build complete.
  Added:    2 files → 4 output files created
  Modified: 1 file  → 1 declaration updated (surgical)
  Deleted:  1 file  → 2 output files removed
  Drifted:  1 file  → skipped (run /logi reverse)
  Unchanged: 5 files
```

---

## `status` Command

Run:
```
node .agents/skills/logi/logi_utils.cjs status [module]
```
Display the human-readable portion of the output (everything before `__JSON__`). Then add a summary count.

---

## `reverse` Command

**Purpose**: Make `.logi` files reflect actual code — handles both drift (tracked file changed) and untracked code (new file with no `.logi` source).

Two detection modes run in one pass:
- **Drift mode**: output file is in `hashes.json` but its content hash changed → update existing `.logi` declaration
- **Onboard mode**: output file is NOT in `hashes.json` → new code with no Logi source → generate new `.logi` block and register it

### With specific output file:
```
/logi [module] reverse src/generated/auth/AuthService.ts
```
1. Run: `node .agents/skills/logi/logi_utils.cjs reverse-lookup [module] src/generated/auth/AuthService.ts`
2. **If found in hashes** → drift mode: proceed to sync
3. **If not found in hashes** → onboard mode: proceed to generate new declaration

### Without argument (scan everything):
1. Run: `node .agents/skills/logi/logi_utils.cjs status [module]` → get `drifted` list
2. Scan the `output` directory (from `project.logi.jsonc`) for any code files **not** tracked in `hashes.json` → collect as `untracked` list
3. Process all drifted + untracked files in one pass
4. Show combined diff/preview; ask for a **single confirmation** before writing anything

### For each drifted file (tracked, code changed):
1. Read current content of each output file in its `outputs` map
2. Read current `.logi` source content
3. Send to LLM:

   > **Current `.logi` source** (`<file>`):
   > ```logi
   > <content>
   > ```
   > **Current implementation** (`<outputFile>`):
   > ```<language>
   > <content>
   > ```
   > Task: Produce an updated `.logi` file that accurately reflects what the implementation code actually does. Preserve Logi DSL structure and keywords. Fix declarations to match the implementation. Do not invent Logi syntax — use only valid Logi keywords.

4. Collect proposed updated `.logi` content

### For each untracked file (new code, no `.logi` source):
1. Read the code file content
2. Send to LLM:

   > **New implementation file** (`<outputFile>`):
   > ```<language>
   > <content>
   > ```
   > Task: Generate a new Logi declaration block that accurately represents this code. Use the correct Logi keyword (`type`, `usecase`, `screen`, `widget`, etc.). Use only valid Logi DSL syntax from the spec.

3. Ask user: **which `.logi` contract file** should this declaration be appended to? (list existing `.logi` files as options, or allow specifying a new file path)
4. Collect proposed new declaration

### After processing all files:
1. Show **combined diff** — all drifted updates + all new declarations to be appended
2. **Wait for user confirmation** before writing anything
3. Write all updated `.logi` files
4. For drifted: run `node .agents/skills/logi/logi_utils.cjs hash [module] <logiFile>` (keeps output map unchanged, updates source hashes)
5. For untracked: run `node .agents/skills/logi/logi_utils.cjs hash [module] <logiFile> <outputFile>` (registers new mapping in hashes)

---

## `init` Command

Run:
```
node .agents/skills/logi/logi_utils.cjs init [module]
```
This creates:
- `<baseDir>/project.logi.jsonc` (template)
- `<baseDir>/logi.md` (template)
- `<baseDir>/.logi/hashes.json` (empty)

Then tell the user:
> Files created. Next steps:
> 1. Edit `project.logi.jsonc` — set language, framework, source dir, output dir
> 2. Edit `logi.md` — define translation rules (file organization, naming, patterns)
> 3. Add `.logi` files to your contracts dir
> 4. Run `/logi build`

---

## Translation Reference

### Logi → Code mapping by construct

| Logi construct | Typical output |
|---|---|
| `type` | Interface / data class / struct / Pydantic model |
| `failure` | Typed error/exception class |
| `usecase` | Service function / use-case handler / ViewModel |
| `widget` | Reusable UI component (props interface + component body) |
| `screen` | Page/view component with local state and event wiring |
| `flow` | Router configuration / navigation graph |
| `job` | Background task / queue worker |
| `system_event` | System-level event handler |

### Show primitives → UI elements

| Logi `show` | HTML/React | Native |
|---|---|---|
| `show text <role>` | `<p>` / `<span>` | `Text` |
| `show badge <role>` | `<span class="badge">` | custom Badge |
| `show input <role>` | `<input type="text">` | `TextInput` |
| `show password_input <role>` | `<input type="password">` | `TextInput secureTextEntry` |
| `show button <role>` | `<button>` | `Pressable`/`TouchableOpacity` |
| `show helper_text <role>` | `<p class="helper">` | `Text` (muted) |
| `show error_text <role>` | `<p class="error">` | `Text` (error) |
| `show spinner <role>` | loading spinner | `ActivityIndicator` |
| `show widget <name>` | component render | component render |

### Annotation handling

| Annotation | Implementation hint |
|---|---|
| `@entity` | Add ORM entity/model annotations |
| `@table("name")` | Map to specific DB table |
| `@id` | Mark as primary key |
| `@endpoint(method, path)` | Generate REST controller/route |
| `@requires_auth` | Add auth middleware/guard |
| `@role("admin")` | Add role-based access check |
| `@route("path")` | Register in router |
| `@render("strict")` | Do NOT add any UI elements not in the `.logi` file |
| `@render("expressive")` | May add reasonable decorative elements |

---

## Operational Constraints

- **Never modify `.logi` or `.logid` files** during a `build` — only `reverse` writes to source files
- **Never commit** unless explicitly asked
- **Declaration-level granularity**: never send an entire 200-declaration file to LLM for a 1-line change
- **Respect `logi.md` exactly**: naming, file structure, patterns, do-not list — no deviations
- **Drifted files require confirmation** before overwriting
- **Reverse requires confirmation** before writing updated `.logi` — always show diff first
