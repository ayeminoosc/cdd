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
  // Support colon-separated nested paths: "parent:sub" → "parent/sub"
  // This lets you target /parent/sub from the root: /logi parent:sub build
  const normalized = moduleArg.replace(/:/g, '/');
  return path.isAbsolute(normalized)
    ? normalized
    : path.resolve(process.cwd(), normalized);
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
//   component  (contains usecase sub-blocks)
// Enum types:  type name = a | b | c  (single line, no 'end')
// ---------------------------------------------------------------------------

const BLOCK_KEYWORDS = new Set([
  'type', 'failure', 'usecase', 'widget', 'screen', 'flow', 'job', 'component'
]);

// Keywords that are single-line declarations (no 'end' block)
const SINGLE_LINE_KEYWORDS = new Set(['system_event']);

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

      // Single-line declarations (no 'end' block)
      const singleMatch = trimmed.match(/^(\w+)\s+(\w+)/);
      if (singleMatch && SINGLE_LINE_KEYWORDS.has(singleMatch[1])) {
        declarations[`${singleMatch[1]}.${singleMatch[2]}`] = line;
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
      } else if (NESTED_BLOCK_KEYWORDS.has(trimmed.split(/\s/)[0]) || BLOCK_KEYWORDS.has(trimmed.split(/\s/)[0])) {
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
// LogiD block extractor
// Extracts top-level blocks from a .logid file:
//   tokens, style, variant, theme, motion  → { keyword, name, text }[]
// ---------------------------------------------------------------------------

const LOGID_TOP_KEYWORDS = new Set(['tokens', 'style', 'variant', 'theme', 'motion']);
const LOGID_NESTED_OPENERS = new Set(['hover', 'active', 'focus', 'disabled', 'selected', 'loading', 'error']);

function extractTopLevelLogidBlocks(content) {
  const blocks = [];
  const lines = content.split('\n');
  let depth = 0;
  let current = null;
  let blockLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      if (current) blockLines.push(line);
      continue;
    }

    if (depth === 0) {
      const parts = trimmed.split(/\s+/);
      if (!parts[0] || !LOGID_TOP_KEYWORDS.has(parts[0])) continue;
      current = { keyword: parts[0], name: parts.slice(1).join(' ') };
      blockLines = [line];
      depth = 1;
    } else {
      blockLines.push(line);
      if (trimmed === 'end') {
        depth--;
        if (depth === 0 && current) {
          blocks.push({ ...current, text: blockLines.join('\n') });
          current = null;
          blockLines = [];
        }
      } else {
        const firstWord = trimmed.split(/\s/)[0];
        // Sub-block openers increase depth
        if (LOGID_NESTED_OPENERS.has(firstWord) ||
            trimmed.startsWith('on mobile') ||
            trimmed.startsWith('on tablet') ||
            trimmed.startsWith('on desktop') ||
            (trimmed.startsWith('.') && !trimmed.includes(':'))) {
          depth++;
        }
      }
    }
  }
  return blocks;
}

/**
 * Returns the relevant logid blocks (tokens + style + variants + themes + motions)
 * for a given declaration name from the paired .logid file.
 * declName is like "widget.login_form" — we use the short name for matching.
 */
function getLogidContextForDecl(baseDir, logiFileRel, declName) {
  const logidPath = path.join(baseDir, logiFileRel.replace(/\.logi$/, '.logid'));
  if (!fs.existsSync(logidPath)) return null;
  const content = fs.readFileSync(logidPath, 'utf8');
  const allBlocks = extractTopLevelLogidBlocks(content);
  const shortName = declName.includes('.') ? declName.split('.').slice(1).join('.') : declName;

  const relevant = allBlocks
    .filter(b =>
      b.keyword === 'tokens' ||
      (b.keyword === 'style' && b.name === shortName) ||
      (b.keyword === 'variant' && b.name.startsWith(shortName + ' ')) ||
      b.keyword === 'theme' ||
      b.keyword === 'motion'
    )
    .map(b => b.text);

  return relevant.length ? relevant.join('\n\n') : null;
}

// ---------------------------------------------------------------------------
// Referenced type/failure finder
// For a declaration block text, returns subset of allDecls that are type/failure
// declarations whose name appears in the text.
// ---------------------------------------------------------------------------

function findReferencedTypeBlocks(declText, allDecls) {
  const result = {};
  for (const [key, blockText] of Object.entries(allDecls)) {
    if (!key.startsWith('type.') && !key.startsWith('failure.')) continue;
    const name = key.split('.').slice(1).join('.');
    const regex = new RegExp(`\\b${name}\\b`);
    if (regex.test(declText)) {
      result[key] = blockText;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Build context generator
// Produces .logi/build_context.json — the single JSON file the agent reads
// before translating. Contains everything the LLM needs: config, rules, diffs,
// declaration texts, referenced types, paired logid blocks, existing outputs.
// ---------------------------------------------------------------------------

function loadTranslationRules(baseDir, cfg) {
  const pluginsDir = path.join(__dirname, 'plugins');
  const parts = [];

  // Language plugin (e.g. kotlin.md, typescript.md, java.md)
  if (cfg.language) {
    const langPlugin = path.join(pluginsDir, `${cfg.language.toLowerCase()}.md`);
    if (fs.existsSync(langPlugin)) parts.push(fs.readFileSync(langPlugin, 'utf8'));
  }

  // Framework plugin (e.g. spring.md, react.md)
  if (cfg.framework) {
    const fwPlugin = path.join(pluginsDir, `${cfg.framework.toLowerCase()}.md`);
    if (fs.existsSync(fwPlugin)) parts.push(fs.readFileSync(fwPlugin, 'utf8'));
  }

  // Project-specific overrides (logi.md in module dir) — loaded last, highest priority
  const rulesPath = path.join(baseDir, 'logi.md');
  if (fs.existsSync(rulesPath)) parts.push(fs.readFileSync(rulesPath, 'utf8'));

  return parts.join('\n\n---\n\n');
}

function buildContext(baseDir) {
  const cfg = loadProjectConfig(baseDir);
  const translationRules = loadTranslationRules(baseDir, cfg);
  const hashes = loadHashes(baseDir);
  const diff = getDiff(baseDir);

  // Helper: read all current output file contents for a source logi file
  function getExistingOutputs(logiFileRel) {
    const entry = hashes[logiFileRel];
    if (!entry || !entry.outputs) return {};
    const outputs = {};
    for (const outRel of Object.keys(entry.outputs)) {
      const absOut = path.join(baseDir, outRel);
      if (fs.existsSync(absOut)) {
        outputs[outRel] = fs.readFileSync(absOut, 'utf8');
      }
    }
    return outputs;
  }

  const items = [];
  const deletedDeclarations = [];

  // --- Added files: send full .logi + full .logid content ---
  for (const fileRel of diff.added) {
    const absLogi = path.join(baseDir, fileRel);
    const logiContent = fs.existsSync(absLogi) ? fs.readFileSync(absLogi, 'utf8') : '';
    const logidPath = path.join(baseDir, fileRel.replace(/\.logi$/, '.logid'));
    const logidContent = fs.existsSync(logidPath) ? fs.readFileSync(logidPath, 'utf8') : null;
    items.push({
      file: fileRel,
      mode: 'added',
      logiContent,
      logidContent,
      existingOutputs: {}
    });
  }

  // --- Modified files: declaration-level surgical items ---
  for (const mod of diff.modified) {
    const absLogi = path.join(baseDir, mod.file);
    const logiContent = fs.existsSync(absLogi) ? fs.readFileSync(absLogi, 'utf8') : '';
    const allDecls = parseLogiDeclarations(logiContent);
    const existingOutputs = getExistingOutputs(mod.file);

    for (const declName of [...mod.changedDeclarations, ...mod.newDeclarations]) {
      const declText = allDecls[declName] || '';
      items.push({
        file: mod.file,
        mode: mod.changedDeclarations.includes(declName) ? 'modified' : 'new_declaration',
        declarationName: declName,
        declarationText: declText,
        referencedTypes: findReferencedTypeBlocks(declText, allDecls),
        logidContext: getLogidContextForDecl(baseDir, mod.file, declName),
        existingOutputs
      });
    }

    // Collect deleted declarations separately
    for (const declName of mod.deletedDeclarations) {
      deletedDeclarations.push({
        file: mod.file,
        declarationName: declName,
        existingOutputs
      });
    }
  }

  const context = {
    baseDir,
    config: cfg,
    translationRules,
    deleted: diff.deleted,
    drifted: diff.drifted,
    items,
    deletedDeclarations,
    unchanged: diff.unchanged
  };

  const outDir = path.join(baseDir, '.logi');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'build_context.json');
  fs.writeFileSync(outPath, JSON.stringify(context, null, 2) + '\n', 'utf8');
  return outPath;
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

const LOGI_MD_TEMPLATE = `# Logi Translation Rules (Project-Specific)
#
# Language and framework rules are loaded automatically from built-in plugins:
#   .agents/skills/logi/plugins/<language>.md   ← e.g. kotlin.md, typescript.md
#   .agents/skills/logi/plugins/<framework>.md  ← e.g. spring.md, react.md
#
# Add ONLY project-specific content here. Do not duplicate general language/framework rules.

## File Organization
<!--
Describe where to generate files per Logi construct, e.g.:
- type / failure  → src/main/kotlin/com/example/model/<Name>.kt
- component       → src/main/kotlin/com/example/service/<Name>Service.kt
                    + src/main/kotlin/com/example/controller/<Name>Controller.kt
- usecase         → src/main/kotlin/com/example/service/<Name>.kt
-->

## Project Conventions
<!--
- Path aliases or import prefixes specific to this project
- Specific base classes/interfaces to extend (e.g. BaseEntity, BaseController)
- Shared utilities (e.g. ObjectMapperProvider.get(), AuthContext.current())
- Error handling pattern (e.g. GlobalExceptionHandler already exists — don't generate one)
-->

## Patterns & Examples
<!--
Paste representative existing code from THIS project so the LLM matches its exact style.
The more concrete examples, the more consistent the output.
-->

## Do-Not List
<!--
- Project-specific things to avoid (e.g. do not use Lombok, do not use field injection)
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
    // Convert colon-path "parent:sub" → "parent/sub" before resolving
    const normalizedCandidate = rest[0].replace(/:/g, '/');
    const candidate = path.resolve(process.cwd(), normalizedCandidate);
    const isInit = cmd === 'init';
    // For init: accept any non-flag arg as module even if dir doesn't exist yet
    // For others: only accept if directory already exists
    if (isInit || (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory())) {
      moduleArg = rest[0];  // keep original (resolveBaseDir normalizes it)
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
      // Paths may be module-relative OR root-relative — normalize either to module-relative.
      const toModuleRel = (p) => {
        const abs = path.resolve(process.cwd(), p);
        if (abs.startsWith(baseDir + path.sep) || abs.startsWith(baseDir + '/')) {
          return path.relative(baseDir, abs).replace(/\\/g, '/');
        }
        return p.replace(/\\/g, '/');
      };
      const logiFile = rest[0] ? toModuleRel(rest[0]) : null;
      const outputs  = rest.slice(1).map(toModuleRel);
      if (!logiFile) { console.error('hash: missing logiFile argument'); process.exit(1); }
      recordTranslation(baseDir, logiFile, outputs);
      console.log(`Recorded: ${logiFile} → [${outputs.join(', ')}]`);
      break;
    }

    case 'delete': {
      // logi_utils.cjs delete [module] <logiFile>
      // Accept module-relative or root-relative path.
      const toModuleRelD = (p) => {
        const abs = path.resolve(process.cwd(), p);
        if (abs.startsWith(baseDir + path.sep) || abs.startsWith(baseDir + '/')) {
          return path.relative(baseDir, abs).replace(/\\/g, '/');
        }
        return p.replace(/\\/g, '/');
      };
      const logiFile = rest[0] ? toModuleRelD(rest[0]) : null;
      if (!logiFile) { console.error('delete: missing logiFile argument'); process.exit(1); }
      const outputs = removeFromHashes(baseDir, logiFile);
      console.log(`Removed hash entry for: ${logiFile}`);
      console.log('__OUTPUTS__');
      outputs.forEach(o => console.log(o));
      break;
    }

    case 'reverse-lookup': {
      const rawPath = rest[0];
      if (!rawPath) { console.error('reverse-lookup: missing outputFile argument'); process.exit(1); }

      // Resolve the path: try as-is (relative to baseDir), then relative to output dir.
      // This means the user can pass either the full relative path OR just the filename/subpath
      // relative to the output directory defined in project.logi.jsonc.
      let resolvedPath = rawPath.replace(/^\.[\/\\]/, ''); // strip leading ./
      let source = reverseMapOutputFile(baseDir, resolvedPath);

      if (!source) {
        // Try resolving relative to the configured output dir
        try {
          const cfg = loadProjectConfig(baseDir);
          const outputDir = cfg.output || 'src/generated';
          const pathViaOutput = path.join(outputDir, rawPath).replace(/\\/g, '/');
          source = reverseMapOutputFile(baseDir, pathViaOutput);
          if (source) resolvedPath = pathViaOutput;
        } catch (_) { /* project.logi.jsonc may not exist — ignore */ }
      }

      if (source) {
        console.log(source);
      } else {
        // Not tracked — signal the agent to use onboard (generate new .logi) mode.
        // Do NOT exit with code 1; the agent must be able to check this cleanly.
        console.log('__UNTRACKED__');
        console.log(`resolved: ${resolvedPath}`);
      }
      break;
    }

    case 'build-context': {
      const outPath = buildContext(baseDir);
      console.log(`Build context written to: ${outPath}`);
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
      console.error('Commands: build-context, status, hash, delete, reverse-lookup, init');
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
  extractTopLevelLogidBlocks,
  getLogidContextForDecl,
  findReferencedTypeBlocks,
  buildContext,
  initWorkspace,
};

// Run CLI if invoked directly
if (require.main === module) {
  main();
}
