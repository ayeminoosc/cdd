#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateHash(text) {
  return crypto.createHash('md5').update(text, 'utf8').digest('hex');
}

function stripJsonComments(text) {
  // Remove // and /* */ comments from JSONC
  return text
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function resolveBaseDir(moduleArg) {
  if (!moduleArg) return process.cwd();
  // Support both absolute and relative
  return path.isAbsolute(moduleArg)
    ? moduleArg
    : path.resolve(process.cwd(), moduleArg);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadProjectConfig(baseDir) {
  const cfgPath = path.join(baseDir, 'project.logi.jsonc');
  if (!fs.existsSync(cfgPath)) {
    throw new Error(`project.logi.jsonc not found in ${baseDir}\nRun: /logi init  (or /logi <module> init)`);
  }
  const raw = fs.readFileSync(cfgPath, 'utf8');
  return JSON.parse(stripJsonComments(raw));
}

// ---------------------------------------------------------------------------
// Hash store
// ---------------------------------------------------------------------------

function hashesPath(baseDir) {
  return path.join(baseDir, '.logi', 'hashes.json');
}

function loadHashes(baseDir) {
  const p = hashesPath(baseDir);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function saveHashes(baseDir, data) {
  const dir = path.join(baseDir, '.logi');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(hashesPath(baseDir), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Logi declaration parser
// Parses a .logi file into { declarationName: blockText } map.
//
// module   → single-line namespace label (no 'end'), recorded as "module.<name>"
// Blocks (closed by 'end'):
//   type  failure  usecase  widget  screen  flow  job  system_event
// Enum types:  type name = a | b | c  (single line, no 'end')
// ---------------------------------------------------------------------------

const BLOCK_KEYWORDS = new Set([
  'type', 'failure', 'usecase', 'widget', 'screen', 'flow', 'job', 'system_event'
]);

// Keywords that open nested sub-blocks (increase depth inside a declaration)
const NESTED_BLOCK_KEYWORDS = new Set([
  'when', 'otherwise', 'each', 'repeat'
]);

function parseLogiDeclarations(content) {
  const lines = content.split('\n');
  const declarations = {}; // key -> full block text
  let depth = 0;
  let currentName = null;
  let blockLines = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comment lines
    if (trimmed.startsWith('#')) {
      if (currentName) blockLines.push(line);
      continue;
    }

    // Skip annotation lines at top level (they'll be included if inside a block)
    if (depth === 0 && trimmed.startsWith('@')) {
      continue;
    }

    if (depth === 0) {
      // module declaration — single line, no block
      const moduleMatch = trimmed.match(/^module\s+(\w+)/);
      if (moduleMatch) {
        declarations[`module.${moduleMatch[1]}`] = line;
        continue;
      }

      // Enum type — single line: "type name = a | b | c"
      const enumMatch = trimmed.match(/^type\s+(\w+)\s*=\s*.+/);
      if (enumMatch) {
        declarations[`type.${enumMatch[1]}`] = line;
        continue;
      }

      // Block declaration opener
      const match = trimmed.match(/^(\w+)\s+(\w+)/);
      if (match && BLOCK_KEYWORDS.has(match[1])) {
        currentName = `${match[1]}.${match[2]}`;
        blockLines = [line];
        depth = 1;
        continue;
      }
    } else {
      blockLines.push(line);

      // Count nested block depth
      if (trimmed === 'end') {
        depth--;
        if (depth === 0 && currentName) {
          declarations[currentName] = blockLines.join('\n');
          currentName = null;
          blockLines = [];
        }
      } else if (NESTED_BLOCK_KEYWORDS.has(trimmed.split(/\s/)[0])) {
        depth++;
      }
    }
  }

  return declarations;
}

// ---------------------------------------------------------------------------
// File scanner
// ---------------------------------------------------------------------------

function scanLogiFiles(baseDir, sourceDir) {
  const absSource = path.resolve(baseDir, sourceDir);
  if (!fs.existsSync(absSource)) return [];

  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.logi')) {
        // Store relative to baseDir
        results.push(path.relative(baseDir, full));
      }
    }
  }
  walk(absSource);
  return results;
}

// ---------------------------------------------------------------------------
// Diff engine
// ---------------------------------------------------------------------------

/**
 * Returns:
 * {
 *   added:    [ logiFile, ... ],
 *   modified: [ { file, changedDeclarations[], newDeclarations[], deletedDeclarations[] }, ... ],
 *   deleted:  [ { file, outputs: { path: hash } }, ... ],
 *   unchanged: [ logiFile, ... ],
 *   drifted:  [ { file, driftedOutputs: [ outputPath, ... ] }, ... ]
 * }
 */
function getDiff(baseDir) {
  const cfg    = loadProjectConfig(baseDir);
  const hashes = loadHashes(baseDir);
  const files  = scanLogiFiles(baseDir, cfg.source || 'contracts');

  const added     = [];
  const modified  = [];
  const unchanged = [];
  const drifted   = [];
  const seen      = new Set();

  for (const rel of files) {
    seen.add(rel);
    const absPath = path.join(baseDir, rel);
    const content = fs.readFileSync(absPath, 'utf8');
    const currDecls = parseLogiDeclarations(content);

    if (!hashes[rel]) {
      added.push(rel);
      continue;
    }

    const stored = hashes[rel];
    const storedDecls = stored.declarations || {};

    // Compare declarations
    const changed  = [];
    const newDecls = [];
    const deleted  = [];

    for (const [name, blockText] of Object.entries(currDecls)) {
      const hash = calculateHash(blockText);
      if (!storedDecls[name]) {
        newDecls.push(name);
      } else if (storedDecls[name] !== hash) {
        changed.push(name);
      }
    }
    for (const name of Object.keys(storedDecls)) {
      if (!currDecls[name]) deleted.push(name);
    }

    if (changed.length || newDecls.length || deleted.length) {
      modified.push({ file: rel, changedDeclarations: changed, newDeclarations: newDecls, deletedDeclarations: deleted });
    } else {
      // Check for drift in output files
      const outputs = stored.outputs || {};
      const driftedOutputs = [];
      for (const [outRel, outHash] of Object.entries(outputs)) {
        const absOut = path.join(baseDir, outRel);
        if (fs.existsSync(absOut)) {
          const currentHash = calculateHash(fs.readFileSync(absOut, 'utf8'));
          if (currentHash !== outHash) driftedOutputs.push(outRel);
        }
      }
      if (driftedOutputs.length) {
        drifted.push({ file: rel, driftedOutputs });
      } else {
        unchanged.push(rel);
      }
    }
  }

  // Detect deleted files (in hashes but not on disk)
  const deleted = [];
  for (const rel of Object.keys(hashes)) {
    if (!seen.has(rel)) {
      deleted.push({ file: rel, outputs: hashes[rel].outputs || {} });
    }
  }

  return { added, modified, deleted, unchanged, drifted };
}

// ---------------------------------------------------------------------------
// Hash recording
// ---------------------------------------------------------------------------

/**
 * After translation: record source declaration hashes + output file hashes.
 * outputFiles: array of file paths relative to baseDir
 */
function recordTranslation(baseDir, logiFileRel, outputFilesRel) {
  const hashes  = loadHashes(baseDir);
  const absPath = path.join(baseDir, logiFileRel);
  const content = fs.readFileSync(absPath, 'utf8');
  const decls   = parseLogiDeclarations(content);

  const declHashes = {};
  for (const [name, blockText] of Object.entries(decls)) {
    declHashes[name] = calculateHash(blockText);
  }

  const outputHashes = {};
  for (const rel of outputFilesRel) {
    const absOut = path.join(baseDir, rel);
    if (fs.existsSync(absOut)) {
      outputHashes[rel] = calculateHash(fs.readFileSync(absOut, 'utf8'));
    }
  }

  hashes[logiFileRel] = {
    declarations: declHashes,
    last_translated: new Date().toISOString(),
    outputs: outputHashes
  };

  saveHashes(baseDir, hashes);
}

/**
 * Remove a logi file entry from hashes and return its output file list.
 */
function removeFromHashes(baseDir, logiFileRel) {
  const hashes  = loadHashes(baseDir);
  const entry   = hashes[logiFileRel];
  const outputs = entry ? Object.keys(entry.outputs || {}) : [];
  delete hashes[logiFileRel];
  saveHashes(baseDir, hashes);
  return outputs;
}

/**
 * Given a generated output file path, return the source .logi file that produced it.
 */
function reverseMapOutputFile(baseDir, outputFileRel) {
  const hashes = loadHashes(baseDir);
  for (const [logiFile, entry] of Object.entries(hashes)) {
    if (entry.outputs && entry.outputs[outputFileRel] !== undefined) {
      return logiFile;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Init scaffolding
// ---------------------------------------------------------------------------

const PROJECT_CONFIG_TEMPLATE = `{
  // Logi workspace configuration
  // See: https://github.com/ayeminoosc/cdd/.agents/skills/logi/SETUP.md

  "language": "typescript",    // e.g. typescript, java, python, swift, kotlin
  "framework": "react",        // e.g. react, vue, next, spring, fastapi
  "source": "contracts",       // dir containing .logi and .logid files (relative to this file)
  "output": "src/generated"    // dir where generated code will be written (relative to this file)
}
`;

const LOGI_MD_TEMPLATE = `# Logi Translation Rules

## Target Stack
<!-- e.g. TypeScript 5, React 18, Vite, TailwindCSS -->

## File Organization
<!--
Describe what files to generate per Logi construct, e.g.:
- type / failure  → src/generated/types/<Name>.ts
- usecase         → src/generated/usecases/<Name>.ts
- widget / screen → src/generated/components/<Name>.tsx
- flow            → src/generated/router/index.ts
-->

## Coding Conventions
<!--
- Naming: PascalCase for components, camelCase for functions/vars
- File naming: match declaration name exactly
- Imports: use @/ path aliases
- Always use async/await, never raw Promises
-->

## Per-Construct Rules
<!--
type       → TypeScript interface (readonly fields, no class)
failure    → TypeScript class extending Error with typed fields
usecase    → async function exported from a service module; validate inputs first
widget     → React functional component accepting Props interface; use Tailwind for styling
screen     → React page component registered in the router
flow       → React Router v6 routes object
job        → async function invoked by a scheduler/queue
-->

## Patterns & Examples
<!--
Paste representative existing code here so the LLM matches the project's style.
The more examples, the more consistent the output.
-->

## Do-Not List
<!--
- Do not use class components
- Do not use any (use unknown and narrow)
- Do not import from relative paths outside src/
- Do not generate CSS modules — use Tailwind only
-->
`;

function initWorkspace(baseDir) {
  const cfgPath   = path.join(baseDir, 'project.logi.jsonc');
  const rulesPath = path.join(baseDir, 'logi.md');
  const hashDir   = path.join(baseDir, '.logi');
  const hashFile  = path.join(hashDir, 'hashes.json');

  const created = [];

  // Ensure baseDir itself exists (for new module directories)
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

  if (!fs.existsSync(cfgPath)) {
    fs.writeFileSync(cfgPath, PROJECT_CONFIG_TEMPLATE, 'utf8');
    created.push('project.logi.jsonc');
  }
  if (!fs.existsSync(rulesPath)) {
    fs.writeFileSync(rulesPath, LOGI_MD_TEMPLATE, 'utf8');
    created.push('logi.md');
  }
  if (!fs.existsSync(hashDir)) fs.mkdirSync(hashDir, { recursive: true });
  if (!fs.existsSync(hashFile)) {
    fs.writeFileSync(hashFile, '{}\n', 'utf8');
    created.push('.logi/hashes.json');
  }

  return created;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function formatStatus(diff) {
  const lines = [];
  const row = (file, decl, status, note = '') =>
    lines.push(`  ${status.padEnd(10)} ${file}${decl ? '  [' + decl + ']' : ''}${note ? '  (' + note + ')' : ''}`);

  for (const f of diff.added)     row(f, null, 'ADDED');
  for (const m of diff.modified) {
    for (const d of m.newDeclarations)     row(m.file, d, 'NEW');
    for (const d of m.changedDeclarations) row(m.file, d, 'MODIFIED');
    for (const d of m.deletedDeclarations) row(m.file, d, 'DELETED');
  }
  for (const d of diff.deleted) row(d.file, null, 'FILE DEL', 'outputs need cleanup');
  for (const dr of diff.drifted) row(dr.file, null, 'DRIFTED', dr.driftedOutputs.join(', '));
  for (const f of diff.unchanged) row(f, null, 'ok');

  return lines.length ? lines.join('\n') : '  Everything up to date.';
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage: logi_utils.cjs <command> [module] [args...]');
    process.exit(1);
  }

  const cmd = args[0];

  // Commands that take optional [module] as arg[1]
  // Detect: if arg[1] looks like a subdir (no dots, not a path), treat as module
  let moduleArg = null;
  let rest = args.slice(1);

  if (rest.length && !rest[0].includes('.') && !path.isAbsolute(rest[0]) && rest[0] !== '--') {
    const candidate = path.resolve(process.cwd(), rest[0]);
    const isInit = cmd === 'init';
    // For init: accept any non-flag arg as module even if dir doesn't exist yet
    // For others: only accept if directory already exists
    if (isInit || (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory())) {
      moduleArg = rest[0];
      rest = rest.slice(1);
    }
  }

  const baseDir = resolveBaseDir(moduleArg);

  switch (cmd) {
    case 'status': {
      const diff = getDiff(baseDir);
      console.log(`\nLogi Status — ${baseDir}\n`);
      console.log(formatStatus(diff));
      console.log();
      // Machine-readable JSON output for SKILL.md parsing
      process.stdout.write('\n__JSON__\n' + JSON.stringify(diff) + '\n');
      break;
    }

    case 'hash': {
      // logi_utils.cjs hash [module] <logiFile> <out1> [out2...]
      const logiFile = rest[0];
      const outputs  = rest.slice(1);
      if (!logiFile) { console.error('hash: missing logiFile argument'); process.exit(1); }
      recordTranslation(baseDir, logiFile, outputs);
      console.log(`Recorded: ${logiFile} → [${outputs.join(', ')}]`);
      break;
    }

    case 'delete': {
      // logi_utils.cjs delete [module] <logiFile>
      const logiFile = rest[0];
      if (!logiFile) { console.error('delete: missing logiFile argument'); process.exit(1); }
      const outputs = removeFromHashes(baseDir, logiFile);
      console.log(`Removed hash entry for: ${logiFile}`);
      console.log('__OUTPUTS__');
      outputs.forEach(o => console.log(o));
      break;
    }

    case 'reverse-lookup': {
      const outputFile = rest[0];
      if (!outputFile) { console.error('reverse-lookup: missing outputFile argument'); process.exit(1); }
      const source = reverseMapOutputFile(baseDir, outputFile);
      if (source) {
        console.log(source);
      } else {
        console.error(`No Logi source found for output: ${outputFile}`);
        process.exit(1);
      }
      break;
    }

    case 'init': {
      const created = initWorkspace(baseDir);
      if (created.length) {
        console.log(`Initialized Logi workspace in ${baseDir}:`);
        created.forEach(f => console.log(`  created  ${f}`));
      } else {
        console.log(`Workspace already initialized in ${baseDir} (nothing created)`);
      }
      console.log('\nNext steps:');
      console.log('  1. Edit project.logi.jsonc — set language, framework, source, output');
      console.log('  2. Edit logi.md — define coding rules for translation');
      console.log('  3. Add .logi files to your contracts/ directory');
      console.log('  4. Run: /logi build');
      break;
    }

    default:
      console.error(`Unknown command: ${cmd}`);
      console.error('Commands: status, hash, delete, reverse-lookup, init');
      process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Exports (for use as a library from SKILL.md wrapper scripts)
// ---------------------------------------------------------------------------
module.exports = {
  resolveBaseDir,
  loadProjectConfig,
  parseLogiDeclarations,
  calculateHash,
  loadHashes,
  saveHashes,
  scanLogiFiles,
  getDiff,
  recordTranslation,
  removeFromHashes,
  reverseMapOutputFile,
  initWorkspace,
};

// Run CLI if invoked directly
if (require.main === module) {
  main();
}
