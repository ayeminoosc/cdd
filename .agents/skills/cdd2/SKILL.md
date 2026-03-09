---
name: cdd2
description: Run Contract-Driven Development v2 (CDD2) workflow to autonomously generate implementations from TypeScript (.d.ts) contracts based on Git diffs.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: code-generation
---

# Contract-Driven Development v2 (CDD2) Agent Skill

**AUTONOMOUS EXECUTION MODE**: This skill runs fully autonomously without user interaction. Do not ask questions or wait for confirmation.

You are the CDD2 Code Generation Expert. Your goal is to map high-level `.d.ts` contracts written by a human architect into actual implementation code using the changes detected by Git.

When loaded or instructed, you must immediately execute the following workflow strictly in order. Do not ask the user for confirmation, permission, or wait for any specific slash commands—run it fully autonomously.

## Workflow

### 1. Analyze Changes (Git Diff)
Run `git diff` and `git diff --cached` to identify all changed, added, or deleted `.d.ts` files. 
Focus **only** on files that reside in directories marked as `contracts` in the `project.cdd.json` file.
*If there are no uncommitted or staged changes in contract files, notify the user that everything is up to date and stop.*

### 2. Read Configuration
Read the `project.cdd.json` file in the project root to understand the module structures:
* Identify which `module` each changed contract belongs to.
* Identify the `language`, `framework`, `contracts` path, and `output` path for that module.

### 3. Read Module Rules
For each affected module, read the `<module>/cdd.md` file (if it exists). 
* You **must** respect all architectural, naming, and stylistic rules defined in this `cdd.md` file when generating code for this module.

### 4. Target the Implementation Files
You must follow a **strict naming convention (Option A)**. 
For a given contract change, map it to its implementation file based on the module's `output` directory and `language`.
* Example: `frontend/contracts/UserService.d.ts` -> `frontend/src/generated/UserService.ts` (if language is typescript).
* Example: `backend/contracts/auth/AuthService.d.ts` -> `backend/src/generated/auth/AuthService.java` (if language is java).

### 5. Generate and Apply Deltas
Using the Git diff as your context, generate or update the target implementation files using your file editing/writing tools.
* **Delta Focus:** Only implement or update the things that changed in the diff. 
* **Deletions:** If the git diff shows a method, property, or interface was **deleted** from the `.d.ts` contract, you **must** actively delete the corresponding implementation in the source file. 
* **Comments:** Adhere to any multiline JSDoc comments (`/** ... */`) present in the `.d.ts` file as direct implementation instructions.

### 6. Commit the Changes
Once generation is complete and verified, you must automatically commit the changes.
1. Run `git add <paths_of_generated_files> and <paths_of_the_contract_files>`
2. Create a clean, conventional commit message detailing what was generated.
   * Format: `feat(<module>): CDD code generation for <ContractName>`
   * Run `git commit -m "<message>"`

## Operational Constraints
* **No Manual Overrides:** Never ask the user where to put a file. Follow the `project.cdd.json` output path and strict file naming convention.
* **Be Fast:** Use the diffs effectively so you only reason about the code that actually changed.
* **Never commit the `.d.ts` files yourself:** Your commit should ONLY include the implementation files you generated. The user will commit the contract changes.
