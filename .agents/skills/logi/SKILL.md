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

## Table of Contents

| Section | Purpose |
|---|---|
| [Argument Parsing](#argument-parsing) | How to parse command + module + baseDir |
| [`build` Command](#build-command) | Translate .logi → code (JSON-first, incremental) |
| [`status` Command](#status-command) | Show diff of what has changed |
| [`reverse` Command](#reverse-command) | Sync .logi from code (drift + onboard) |
| [`init` Command](#init-command) | Scaffold a new Logi workspace |
| [Logi DSL Reference](#logi-dsl-reference) | Full grammar for all keywords and annotations |
| [LogiD DSL Reference](#logid-dsl-reference) | Full grammar for .logid design files |
| [Operational Constraints](#operational-constraints) | Rules the agent must always follow |

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
- `<parent>:<sub> build` → `baseDir = ./<parent>/<sub>/`  ← colon-path for nested sub-projects
- `<parent>:<sub> status` etc.

**Colon-path notation** (`parent:sub`) lets you target a sub-project from the repo root without `cd`-ing first:
```
/logi apps:auth build
/logi services:payments status
/logi frontend:dashboard reverse LoginPage.tsx
```
The colon is converted to a path separator — `apps:auth` → `./apps/auth/`. Any depth works: `a:b:c` → `./a/b/c/`.

Extract `baseDir` first. All subsequent paths are relative to `baseDir` unless stated otherwise.

---

## `build` Command

### Step 1 — Generate Build Context (JSON-first)
Run:
```
node .agents/skills/logi/logi_utils.cjs build-context [module]
```
This writes `<baseDir>/.logi/build_context.json` and prints the path. Read that file. It contains everything you need:

```json
{
  "baseDir": "/path/to/module",
  "config": { "language": "typescript", "framework": "react", "source": "contracts", "output": "src/generated" },
  "translationRules": "# Logi Translation Rules\n...",
  "deleted": [{ "file": "contracts/old.logi", "outputs": { "src/generated/Old.ts": "<hash>" } }],
  "drifted": [{ "file": "contracts/auth.logi", "driftedOutputs": ["src/generated/auth/AuthService.ts"] }],
  "items": [
    {
      "file": "contracts/auth.logi",
      "mode": "added",
      "logiContent": "<full .logi file text>",
      "logidContent": "<full .logid file text, or null>",
      "existingOutputs": {}
    },
    {
      "file": "contracts/todo.logi",
      "mode": "modified",
      "declarationName": "usecase.submit_login",
      "declarationText": "usecase submit_login for ...\n  ...\nend",
      "referencedTypes": { "type.session": "type session\n  ...\nend", "failure.validation_failed": "..." },
      "logidContext": "tokens\n  ...\nend\n\nstyle login_form\n  ...\nend",
      "existingOutputs": { "src/generated/auth/AuthService.ts": "<current file content>" }
    }
  ],
  "deletedDeclarations": [
    { "file": "contracts/todo.logi", "declarationName": "usecase.old_usecase", "existingOutputs": { "src/generated/todo/TodoService.ts": "<current content>" } }
  ],
  "unchanged": ["contracts/user.logi"]
}
```

**Do NOT run `status` separately — `build-context` calls diff internally and embeds all the information you need.**

### Step 2 — Handle Deleted Files
For each entry in `context.deleted`:
1. Run `node .agents/skills/logi/logi_utils.cjs delete [module] <file>` — removes the hash entry
2. Delete each file listed in its `outputs` map from disk

### Step 3 — Handle Drifted Files
For each entry in `context.drifted`:
- Notify the user: "Output files for `<file>` were manually edited: `<driftedOutputs>`"
- Ask: **overwrite** (proceed with translate) or **skip** (run `reverse` on this file first)?
- Only proceed with translation for files the user chose to overwrite.

### Step 4 — Translate Items
Process each entry in `context.items`. The `translationRules` and `config` fields in the context JSON apply to every item — follow them exactly.

**`mode: "added"` — new file, generate everything:**
- `logiContent`: the full `.logi` source — read and understand all declarations
- `logidContent`: the full `.logid` source if present (design tokens, styles, variants, themes, motions)
- Use `logi.md` File Organization rules to decide which output files to create and where inside `config.output`
- Generate all output files. Write each to disk.
- Run: `node .agents/skills/logi/logi_utils.cjs hash [module] <logiFile> <out1> [out2...]`

**`mode: "modified"` or `"new_declaration"` — surgical update:**
- `declarationText`: the exact changed block to translate
- `referencedTypes`: type/failure blocks referenced in this declaration — include as context
- `logidContext`: tokens + matching style + variants + themes/motions extracted from the paired `.logid` file
- `existingOutputs`: current content of all output files for this source — surgically update only the parts that changed; preserve everything else
- Send to LLM:

  > **Changed declaration (`<declarationName>`):**
  > ```logi
  > <declarationText>
  > ```
  > **Referenced types:**
  > ```logi
  > <referencedTypes values joined>
  > ```
  > **LogiD design context:**
  > ```
  > <logidContext>
  > ```
  > **Existing output file** (`<path>`):
  > ```<language>
  > <existingOutputs[path]>
  > ```
  > **Translation rules:**
  > ```
  > <translationRules>
  > ```
  > Task: Surgically update the output file to reflect only this changed declaration. Preserve all other code. Follow translation rules exactly. Return the complete updated file content.

- Write the updated output file(s). Run: `node .agents/skills/logi/logi_utils.cjs hash [module] <logiFile> <out1> [out2...]`

### Step 5 — Handle Deleted Declarations
For each entry in `context.deletedDeclarations`:
- Read `existingOutputs` — these are the source files that contain the deleted declaration's code
- Instruct LLM to remove only the code corresponding to `declarationName` from each output file
- Write updated output files
- Run: `node .agents/skills/logi/logi_utils.cjs hash [module] <logiFile> <out1> [out2...]`

### Step 6 — Summary
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

### Round-trip fidelity contract

> **`/logi reverse` → `/logi build` ≈ identical code**

This is the non-negotiable goal. The `.logi` file produced by `reverse` is not a high-level summary — it is a **complete, accurate specification** of the implementation. Every logical detail that drives code generation must be captured:

| Code construct | Logi DSL construct required |
|---|---|
| Method/function signature | `usecase <name> for <exact typed params> returns <exact type>` |
| Guard / if-null check | `check <exact condition>, otherwise fail with <failure> with <exact field and message>` |
| Conditional branch | `when <exact condition> … end` / `otherwise … end` |
| Operation step | `step <precise description naming exact service, method, args>` |
| Return value | `return <exact value or expression>` |
| ORM/persistence | `@entity`, `@table("…")`, `@id`, `@unique`, `@relation(…)` on each field |
| HTTP endpoint | `@endpoint(method: "…", path: "…")` on the usecase |
| Widget prop | `prop <name>: <exact type>` |
| Widget event | `event <name>(<exact params>)` |
| Rendered element | `show <element_type> <name> label "<text>"` |
| Conditional render | `when <exact condition> … end` |
| Screen state | `state <name>: <type> = <default>` — type and default must be exact |
| Screen action | `action <name> -> call <usecase> with <exact args>` |
| Event handler | `on <widget>.<event> -> set <state>` / `run <action>` / `go to <screen>` (ALL handlers, exact) |

**What counts as insufficiently detailed** (avoid these):
- `step save the user` → **wrong** — should be `step save {user} to {user_repository}, set {user.id} from the generated key, and return {user}`
- `check email is valid` → **wrong** — should include the exact failure type and message value from the code
- omitting `= false` from `state is_loading: boolean = false` → causes wrong code generation
- omitting `on submit_login.failed -> set is_loading = false` → causes missing handler in output

### Hard structural rules — NEVER violate these

These are not style preferences — violating them produces unparseable `.logi` files.

**1. No curly braces. Ever.**
Logi uses `end` to close blocks, not `{` / `}`. There are no curly braces anywhere in Logi syntax.

```
# WRONG:
usecase AttachmentConverter {
  usecase convertToDatabaseColumn(attachments: list?): string?
}

# CORRECT — each method becomes its own flat top-level usecase:
usecase convert_attachment_to_db for attachments: attachment[]? returns text?
  step serialize {attachments} to JSON string using object mapper
  return the JSON string
end

usecase convert_db_to_attachment for db_data: text? returns attachment[]?
  step deserialize {db_data} from JSON to list of {attachment} using object mapper
  return the list
end
```

**2. No nesting of declarations inside declarations.**
Every `type`, `failure`, `usecase`, `widget`, `screen`, `flow`, `job` is a **flat top-level block**. One class with multiple methods → multiple separate `usecase` blocks at the top level. Never wrap multiple usecases inside another usecase or type.

**3. Annotations go BEFORE the declaration keyword, on their own lines — never inside the block body.**

```
# WRONG — declaration-level annotations inside type body:
type Memory
  @entity
  @table("memories")
  id: text
  user_id: text
end

# CORRECT — declaration-level annotations immediately before the keyword:
@entity
@table("memories")
type Memory
  @id
  id: text
  user_id: text
end
```

- **Declaration-level annotations** (`@entity`, `@table`, `@endpoint`, `@route`, `@requires_auth`, `@render`, `@test_id`, etc.) → go on the line(s) **immediately before** the opening keyword (`type`, `usecase`, `widget`, `screen`), outside the block.
- **Field-level annotations** (`@id`, `@unique`, `@index`, `@generated`, `@default`, `@relation`) → go on the line **immediately before the field** they annotate, indented inside the block.

**4. `usecase` body contains only Logi body primitives.** Valid: `check`, `when`, `each`, `repeat`, `step`, `return`, `call`, comments (`#`). If the source is a class, the class name does not become a wrapping usecase — map each method to its own top-level `usecase`.

**5. No implementation-language syntax inside `.logi`.** No `if`, `for`, `try`, `throw`, semicolons, type casts, generics (`List<Attachment>`), or language keywords. Use only Logi primitives.

Two detection modes run in one pass:
- **Drift mode**: output file is in `hashes.json` but its content hash changed → update existing `.logi` declaration
- **Onboard mode**: output file is NOT in `hashes.json` → new code with no Logi source → generate new `.logi` block and register it

### Path resolution for the output file argument

The path you pass is resolved **relative to the `output` directory** declared in `project.logi.jsonc`.
You can pass either:
- A short filename/subpath (e.g. `AuthService.ts` or `auth/AuthService.ts`), which is resolved as `<output>/auth/AuthService.ts`
- The full path from the project root (e.g. `src/generated/auth/AuthService.ts`), which is used as-is

Both forms are tried automatically.

### With specific output file:
```
/logi [module] reverse AuthService.ts
# or equivalently:
/logi [module] reverse src/generated/auth/AuthService.ts
```
1. Run: `node .agents/skills/logi/logi_utils.cjs reverse-lookup [module] AuthService.ts`
2. Check the first line of stdout:
   - Anything **other than `__UNTRACKED__`** → it is the source `.logi` file path → **drift mode**
   - `__UNTRACKED__` → file is not registered in hashes → **onboard mode**

> Note: `reverse-lookup` always exits with code **0**. The `__UNTRACKED__` token in stdout (not stderr) is how you detect the onboard case. Never branch on exit code for this command.

### Without argument (scan everything):
1. Run: `node .agents/skills/logi/logi_utils.cjs status [module]` → get `drifted` list
2. Scan the `output` directory (from `project.logi.jsonc`) for any code files **not** tracked in `hashes.json` → collect as `untracked` list
3. Process all drifted + untracked files in one pass
4. Show combined diff/preview; ask for a **single confirmation** before writing anything

### For each drifted file (tracked, code changed):
1. Read current content of each output file in its `outputs` map
2. Read current `.logi` source content
3. Read `logi.md` translation rules (already in build context)
4. Send to LLM with this **exact prompt structure**:

   > **Reverse engineering task — round-trip fidelity required**
   >
   > **Goal**: The `.logi` you produce must be precise enough that running `/logi build` on it would reproduce **functionally identical output code** to what is shown below. This is not a summary — it is a complete, accurate specification of the implementation.
   >
   > **Current `.logi` source** (`<file>`):
   > ```logi
   > <content>
   > ```
   > **Current implementation** (`<outputFile>`):
   > ```<language>
   > <content>
   > ```
   > **Translation rules** (how `.logi` maps to this codebase):
   > ```
   > <translationRules>
   > ```
   >
   > **Mapping rules — apply ALL of these systematically:**
   >
   > **Usecases / service methods / functions:**
   > - Map each method/function to `usecase <name> for <typed params> returns <type>` — keep exact parameter names and types
   > - Map each guard/validation to `check <exact condition>, otherwise fail with <failure> with <exact field and message values>`
   > - Map each `if/else` branch to `when <exact condition> … end` / `otherwise … end`
   > - Map each loop over a collection to `each <item> in <collection> … end`; loop-until to `repeat until <condition> … end`
   > - Map each operation step to `step <precise natural language>` — name the exact operation, service, method, and arguments; do not omit specifics (wrong: `step save the user`; right: `step save {user} to {user_repository} and return the saved record`)
   > - Map each return to `return <exact value>` or `return failure <failure> with <field values>`
   > - Preserve all usecase annotations: `@endpoint(method, path)`, `@public`, `@requires_auth`, `@role("…")`, `@idempotent`, `@job_handler`
   >
   > **Types / entities / DTOs:**
   > - Map each field with its exact name, type, optional marker (`?`), and default value
   > - Preserve all persistence annotations: `@entity`, `@table("…")`, `@id`, `@unique`, `@index`, `@generated`, `@default("…")`, `@relation(kind, target)`
   >
   > **Widgets / UI components:**
   > - Map every prop: `prop <name>: <type>` — exact names and types
   > - Map every emitted event: `event <name>(<params>)` — exact signatures
   > - Map every rendered element: `show <element_type> <name> label "<text>"`
   > - Map every conditional render: `when <exact condition> … end`
   > - Preserve UI annotations: `@test_id("…")`, `@render("…")`, `@variant("…")`, `@motion("…")`, `@platform("…")`
   >
   > **Screens / containers:**
   > - Map every state field: `state <name>: <type> = <default>` — exact types and default values
   > - Map every action: `action <name> -> call <usecase> with <exact args>`
   > - Map every event binding exactly: `on <widget>.<event> -> set <state>` / `on <widget>.<event> -> run <action>` / `on <usecase>.succeeded -> go to <screen>` — wire exactly as the code does, including multiple handlers per event
   > - Preserve screen annotations: `@route("…")`, `@requires_auth`, `@theme("…")`, `@layout("…")`, `@title("…")`
   >
   > **Before writing, verify mentally:**
   > 1. Every function/method in the code is represented by a declaration
   > 2. Every `check` preserves the exact condition and error details (field, message)
   > 3. Every `step` is precise enough to reproduce the same logic
   > 4. Every state field has its correct type and default
   > 5. Every `on` handler is wired exactly as in the code
   > 6. All annotations that affect generated output are present
   >
   > Return only the complete updated `.logi` file — no prose, no markdown fences, no explanation.

5. Collect proposed updated `.logi` content

### For each untracked file (new code, no `.logi` source):
1. Read the code file content
2. Read `logi.md` translation rules (already in build context)
3. Send to LLM with this **exact prompt structure**:

   > **Reverse engineering task — round-trip fidelity required**
   >
   > **Goal**: Generate a Logi declaration that is precise enough that running `/logi build` on it would reproduce **functionally identical code** to what is shown below. This is a complete, accurate specification — not a summary.
   >
   > **Implementation file** (`<outputFile>`):
   > ```<language>
   > <content>
   > ```
   > **Translation rules** (how `.logi` maps to this codebase):
   > ```
   > <translationRules>
   > ```
   >
   > **Mapping rules — apply ALL of these systematically:**
   >
   > - Choose the correct top-level keyword: `type`, `failure`, `usecase`, `widget`, `screen`
   > - **Usecases**: capture exact param names/types, every `check` with exact condition and failure message, every `when`/`otherwise`, every `step` with precise operation detail, every `return`
   > - **Types**: capture every field with exact name, type, optional marker, default, and persistence annotations
   > - **Widgets**: capture every `prop`, `event`, `show`, and `when` block exactly
   > - **Screens**: capture every `state` with type and default, every `action`, every `on` binding exactly, and all `show`/`when` blocks
   > - Preserve all annotations that influence translation: `@endpoint`, `@requires_auth`, `@entity`, `@table`, `@id`, `@route`, `@test_id`, etc.
   >
   > **Before writing, verify mentally:**
   > 1. Every function/method → declaration present
   > 2. Every guard/validation → `check` with exact condition and error values
   > 3. Every step → `step` precise enough to reproduce the operation
   > 4. Every state field → typed with correct default
   > 5. Every event handler → `on` binding exact
   > 6. All translation-relevant annotations present
   >
   > Return only the Logi declaration block — no prose, no markdown fences, no explanation.

4. Ask user: **which `.logi` contract file** should this declaration be appended to? (list existing `.logi` files as options, or allow specifying a new file path)
5. Collect proposed new declaration

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

## Logi DSL Reference

**File extensions**: `.logi` (logic/behavior) and `.logid` (visual design)

Logi is a platform-agnostic DSL. You translate it into idiomatic code in the target language and framework. The LLM decides implementation details — the `.logi` file declares only intent and structure.

---

### Type System

**Built-in types:**
```
text        any string
number      whole number
decimal     precise decimal
boolean     true or false
date        calendar date
datetime    date and time
void        no return value
```

**Modifiers:**
```
T[]         array of T
T?          optional T
```

**Field syntax:**
```
field_name
field_name: type
field_name: type?
field_name: type[]
field_name: type = default
field_name: type? = null
```

**Inline references** — use `{qualified.name}` inside natural-language clauses (`check`, `when`, `step`, `show`):
```
check {email} is not empty, otherwise fail with validation_failed
when {submit_login.error} exists
  show error text with content {submit_login.error.message}
end
```

---

### Keyword Grammar

#### `module`
Groups related declarations.
```
module <name>
  ...
end
```

#### `type`
Record type, inheritance, or enum.
```
type <name>
  <field>
  ...
end

type <name> extends <parent>
  <field>
  ...
end

type <name> = <variant> | <variant> | ...
```
Common annotations: `@entity`, `@table("name")`, `@id`, `@unique`, `@index`, `@relation(kind, target)`, `@generated`, `@default("value")`

#### `failure`
Named failure/error type.
```
failure <name>
  <field>
  ...
end
```

#### `usecase`
The main business operation primitive.
```
usecase <name> for <inputs> returns <return_type>
  check <condition>
  check <condition>, otherwise fail with <failure>
  when <condition>
    ...
  end
  otherwise
    ...
  end
  each <item> in <collection>
    ...
  end
  repeat until <condition>
    ...
  end
  step <natural language description>
  return <value>
  return failure <failure>
  return failure <failure> with <detail>
end
```
Common annotations: `@endpoint(method: "post", path: "/...")`, `@public`, `@requires_auth`, `@role("name")`, `@idempotent`, `@job_handler`, `@description("...")`

#### `widget`
Reusable UI component with props and events.
```
widget <name>
  prop <name>: <type>
  event <name>()
  event <name>(<inputs>)
  state <name>: <type>
  show <...>
  when <condition>
    ...
  end
  each <item> in <collection>
    ...
  end
end
```
Common annotations: `@test_id("name")`, `@render("strict" | "expressive" | "system_native")`, `@variant("name")`, `@motion("name")`, `@platform("web" | "mobile" | "desktop")`

#### `screen`
Top-level page/view with wired state and actions.
```
screen <name>
  state <name>: <type>
  state <name>: <type> = <default>
  action <name> -> call <usecase> with <args>
  show <widget_or_primitive>
  on <source> -> set <state>
  on <source> -> run <action>
  on <source> -> go to <screen>
  on <source> -> back
  when <condition>
    ...
  end
end
```
Common annotations: `@route("/...")`, `@requires_auth`, `@theme("name")`, `@title("name")`, `@layout("..."`

**`action` lifecycle events** (usable in `on`): `<action>.started`, `<action>.failed`, `<action>.succeeded`

#### `show` — all forms
```
# Plain English
show a text input labeled "User name"
show a login button
show an error message below password_field

# Canonical UI primitives (preferred for deterministic output)
show text <role> label "..."
show badge <role> label "..."
show input <role> label "..."
show password_input <role> label "..."
show button <role> label "..."
show helper_text <role> label "..."
show error_text <role> label "..."
show spinner <role>

# Widget rendering
show <widget_name>
show <widget_name> with <value>, <value>                    # positional
show <widget_name> with <prop>: <value>, <prop>: <value>    # named (preferred)
show <widget_name> with variant <variant_name>
show <widget_name> with <prop>: <value> and variant <variant_name>
```

**`@render` modes:**
- `@render("strict")` — generate ONLY explicitly described elements; no extra decoration
- `@render("expressive")` — may add tasteful embellishment
- `@render("system_native")` — prefer platform-native controls

#### `flow`
Navigation graph.
```
flow <name>
  start: <screen>
  route <screen>.<event> -> <screen>
  ...
end
```

#### `job`
Background task / queue worker.
```
job <name>(<inputs>)
  step <description>
  ...
end
```

#### `system_event`
System-level event (message bus, pubsub).
```
system_event <name>(<inputs>)
```

---

### Construct → Output Mapping

| Logi construct | Backend | Web | Mobile/Desktop |
|---|---|---|---|
| `type` | class / schema / DTO | interface / type | data class / model |
| `failure` | error class / exception | error type | error model |
| `usecase` | service method / handler | mutation / query wrapper | ViewModel operation |
| `widget` | — | reusable UI component | reusable view component |
| `screen` | — | page / route component | screen / view |
| `flow` | route policy | router config | navigation graph |
| `job` | worker / scheduled job | background task trigger | background sync task |
| `system_event` | message / event bus event | subscription source | subscription source |

---

### Annotation Reference

| Annotation | Applies to | Implementation hint |
|---|---|---|
| `@entity` | `type` | Add ORM entity/model annotations |
| `@table("name")` | `type` | Map to specific DB table |
| `@id` | field | Mark as primary key |
| `@unique` | field | Add unique constraint |
| `@index` | field | Add index |
| `@relation(kind, target)` | field | ORM relation |
| `@generated` | field | Auto-generated value |
| `@default("value")` | field | Default value |
| `@endpoint(method, path)` | `usecase` | Generate REST controller/route |
| `@public` | `usecase` | No auth required |
| `@requires_auth` | `usecase`, `screen` | Add auth middleware/guard |
| `@role("name")` | `usecase` | Role-based access check |
| `@idempotent` | `usecase` | Safe to retry |
| `@route("/path")` | `screen` | Register in router |
| `@theme("name")` | `screen`, `flow` | Apply named theme |
| `@layout("name")` | `screen` | Page layout template |
| `@title("name")` | `screen` | Page title |
| `@test_id("name")` | `widget` | Add `data-testid` attribute |
| `@render("strict")` | `widget` | Only generate explicitly described UI |
| `@render("expressive")` | `widget` | Allow tasteful embellishment |
| `@render("system_native")` | `widget` | Prefer platform-native controls |
| `@variant("name")` | `widget` | Apply named LogiD variant by default |
| `@motion("name")` | `widget`, `screen` | Apply named LogiD motion preset |
| `@platform("web\|mobile\|desktop")` | `widget` | Target platform hint |

---

### Complete Example — Login Flow

```logi
module auth

@entity
@table("sessions")
type session
  @id
  token: text
  user_id: text
end

failure validation_failed
  field: text?
  message: text
end

failure auth_failed
  message: text
end

@endpoint(method: "post", path: "/login")
@public
usecase login for user_name: text, password: text returns session
  check user_name is not empty, otherwise fail with validation_failed
  check password is not empty, otherwise fail with validation_failed
  step authenticate the user credentials
  return the session
end

@test_id("login_form")
widget login_form
  prop user_name: text
  prop password: text
  prop error_message: text?
  prop is_loading: boolean

  event user_name_changed(value: text)
  event password_changed(value: text)
  event submit_clicked()

  show input user_name_field label "User name"
  show password_input password_field label "Password"

  when {error_message} exists
    show error_text form_error label {error_message}
  end

  show button submit_button label "Sign in"
end

@route("/login")
screen login_screen
  state user_name: text
  state password: text
  state error_message: text?
  state is_loading: boolean = false

  action submit_login -> call login with user_name, password

  show login_form with user_name, password, error_message, is_loading

  on login_form.user_name_changed -> set user_name
  on login_form.password_changed -> set password
  on login_form.submit_clicked -> run submit_login
  on submit_login.started -> set is_loading = true
  on submit_login.failed -> set is_loading = false
  on submit_login.failed -> set error_message = submit_login.error.message
  on submit_login.succeeded -> go to home_screen
end

flow auth_flow
  start: login_screen
  route login_screen.success -> home_screen
end

end
```

---

## LogiDesign DSL Reference (`.logid` files)

**Purpose**: The companion design file to `.logi`. Describes visual appearance — tokens, widget styles, variants, themes, and motion. A `.logid` file pairs with a `.logi` file of the same base name.

When translating, read the paired `.logid` file and apply its styles, variants, and tokens to the generated UI code.

### Keywords
```
tokens    — design system foundation values
style     — base visual appearance for a widget
variant   — named alternative style for a widget
theme     — token overrides for a named theme
motion    — reusable motion/animation behavior
end
```

### `tokens`
```
tokens
  color
    primary: #2563EB
    danger:  #DC2626
    surface: #FFFFFF
    text:    #0F172A
    muted:   #64748B
    border:  #CBD5E1
  end
  font
    body: "Inter"
    sm: 14
    md: 16
    lg: 20
  end
  space
    xs: 4   sm: 8   md: 16   lg: 24   xl: 32
  end
  radius
    sm: 4   md: 10   lg: 18   full: 9999
  end
  shadow
    sm: subtle drop shadow
    md: medium drop shadow
  end
  motion
    quick: 120ms   normal: 220ms
    smooth: ease-out   snappy: ease-in-out
  end
end
```

### `style`
```
style <widget_name>
  # layout
  layout: flex | grid | stack
  direction: row | column
  justify: start | center | end | space-between
  align: start | center | end | stretch
  gap: <space token>
  padding: <token>

  # visual
  background: <color token>
  color: <color token>
  font: <size token>, <weight>
  border: <width> <color token>
  radius: <radius token>
  shadow: <shadow token>
  transition: <motion token>

  # size
  width: full | auto | fit | <size token>
  height: auto | fit | <size token>
  max_width: <size token>

  # child roles (from `as` names in .logi `show` statements)
  .submit_button
    background: primary
    color: surface
  end

  # state blocks
  hover
    background: primary_hover
  end
  focus
    border: 2 focus_ring
  end
  disabled
    opacity: 40%
    cursor: not-allowed
  end
  loading
    opacity: 70%
  end
  error
    border: 2 danger
  end

  # responsive blocks
  on mobile
    padding: sm
  end
  on desktop
    max_width: content_md
  end
end
```

### `variant`
Overrides only what changes from the base style.
```
variant <widget_name> <variant_name>
  background: danger
  color: surface
end
```

### `theme`
Overrides token values for a named theme. Built-in: `dark`, `a11y`, `compact`, `large`.
```
theme dark
  color
    surface:    #0F172A
    background: #020617
    text:       #E2E8F0
    border:     #334155
  end
end
```

### `motion`
```
motion <name>
  enter: soft fade and rise
  exit: soft fade out
  emphasis: quick scale down on press
  duration: normal
  easing: smooth
end
```

### Design application order (specificity, highest wins)
1. child role inside responsive or state block
2. child role block
3. state block
4. responsive block
5. variant
6. base style

### Child roles
Named via `as` in a `.logi` `show` statement. Prefix with `.` in style/variant:
```logi
show a login button as submit_button    →   .submit_button in .logid
```

### How `.logid` pairs with `.logi` at build time
- Read paired `.logid` if it exists (same base name, `.logid` extension)
- Extract the `style` block matching any `widget` being translated
- Extract `variant` blocks referenced via `@variant("name")` or `show ... with variant name`
- Extract `theme` blocks referenced via `@theme("name")`
- Extract `motion` blocks referenced via `@motion("name")`
- Apply the `tokens` block as the design system foundation
- Translate all of this into target-platform styling (CSS vars, Tailwind, SwiftUI modifiers, etc.)

---

## Operational Constraints

- **Never modify `.logi` or `.logid` files** during a `build` — only `reverse` writes to source files
- **Never commit** unless explicitly asked
- **Declaration-level granularity**: never send an entire 200-declaration file to LLM for a 1-line change
- **Respect `logi.md` exactly**: naming, file structure, patterns, do-not list — no deviations
- **Drifted files require confirmation** before overwriting
- **Reverse requires confirmation** before writing updated `.logi` — always show diff first
