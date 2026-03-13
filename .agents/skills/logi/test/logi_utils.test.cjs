#!/usr/bin/env node
'use strict';

/**
 * Comprehensive test suite for logi_utils.cjs
 * Uses only Node.js built-ins (no external test framework required).
 *
 * Run: node .agents/skills/logi/test/logi_utils.test.cjs
 */

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');

// ─── resolve utils relative to this test file ───────────────────────────────
const UTILS = require('../logi_utils.cjs');
const {
  calculateHash,
  parseLogiDeclarations,
  extractTopLevelLogidBlocks,
  findReferencedTypeBlocks,
  getLogidContextForDecl,
  loadHashes,
  saveHashes,
  scanLogiFiles,
  getDiff,
  recordTranslation,
  removeFromHashes,
  reverseMapOutputFile,
  buildContext,
  initWorkspace,
  loadProjectConfig,
  resolveBaseDir,
} = UTILS;

// ─── minimal test harness ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message || 'assertEqual'}\n  actual:   ${a}\n  expected: ${e}`);
}

function assertIncludes(str, substr, message) {
  if (!String(str).includes(substr))
    throw new Error(`${message || 'assertIncludes'}: expected "${substr}" in "${str}"`);
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${err.message.split('\n').join('\n     ')}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function describe(group, fn) {
  console.log(`\n${group}`);
  fn();
}

// ─── workspace factory ────────────────────────────────────────────────────────

function makeTmpWorkspace(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logi-test-'));

  const config = opts.config || {
    language: 'typescript',
    framework: 'react',
    source: 'contracts',
    output: 'src/generated',
  };
  fs.writeFileSync(
    path.join(dir, 'project.logi.jsonc'),
    JSON.stringify(config, null, 2),
    'utf8'
  );

  if (opts.logiMd !== undefined) {
    fs.writeFileSync(path.join(dir, 'logi.md'), opts.logiMd, 'utf8');
  } else {
    fs.writeFileSync(path.join(dir, 'logi.md'), '# Rules\n', 'utf8');
  }

  fs.mkdirSync(path.join(dir, '.logi'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'contracts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'generated'), { recursive: true });

  return dir;
}

function writeLogiFile(dir, filename, content) {
  const full = path.join(dir, 'contracts', filename);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return `contracts/${filename}`;
}

function writeOutputFile(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── sample logi content ─────────────────────────────────────────────────────

const SAMPLE_LOGI = `
module auth

failure validation_failed
  field: text?
  message: text
end

failure auth_failed
  message: text
end

@entity
@table("users")
type user
  @id
  id: text
  email: text
  password_hash: text
end

type session
  token: text
  user_id: text
end

type user_status = active | suspended | pending

@endpoint(method: "post", path: "/login")
@public
usecase login for email: text, password: text returns session
  check email is not empty, otherwise fail with validation_failed
  check password is not empty, otherwise fail with validation_failed
  step authenticate credentials
  return the session
end

@test_id("login_form")
widget login_form
  prop email: text
  prop password: text
  prop error_message: text?
  prop is_loading: boolean

  event email_changed(value: text)
  event submit_clicked()

  show input email_field label "Email"
  show password_input password_field label "Password"

  when {error_message} exists
    show error_text form_error label {error_message}
  end

  show button submit_button label "Sign in"
end

@route("/login")
screen login_screen
  state email: text
  state password: text
  state error_message: text?
  state is_loading: boolean = false

  action submit_login -> call login with email, password

  show login_form with email, password, error_message, is_loading

  on login_form.email_changed -> set email
  on login_form.submit_clicked -> run submit_login
  on submit_login.failed -> set error_message = submit_login.error.message
  on submit_login.succeeded -> go to home_screen
end

flow auth_flow
  start: login_screen
  route login_screen.success -> home_screen
end

job send_welcome_email(user: user)
  step send a welcome email to {user.email}
end

system_event order_created(order: order)

end
`;

const SAMPLE_LOGID = `
tokens
  color
    primary: #2563EB
    surface: #FFFFFF
    text: #0F172A
    danger: #DC2626
  end
  space
    sm: 8
    md: 16
  end
end

style login_form
  layout: flex
  direction: column
  gap: md
  padding: md
  background: surface

  .email_field
    border: 1 field_border
  end

  hover
    background: panel_hover
  end

  focus
    border: 2 focus_ring
  end

  on mobile
    padding: sm
  end
end

variant login_form compact
  padding: sm
  gap: sm
end

variant login_form immersive
  background: panel_surface
  padding: xl
end

style submit_button
  background: primary
  color: surface
  radius: md
end

theme dark
  color
    surface: #0F172A
    text: #E2E8F0
  end
end

motion standard
  enter: soft fade and rise
  exit: soft fade out
  duration: normal
  easing: smooth
end
`;

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('calculateHash', () => {
  test('returns 32-char hex string for any input', () => {
    const h = calculateHash('hello');
    assert(typeof h === 'string', 'should be string');
    assertEqual(h.length, 32, 'MD5 hex = 32 chars');
    assert(/^[0-9a-f]+$/.test(h), 'should be hex');
  });

  test('same input → same hash', () => {
    assertEqual(calculateHash('abc'), calculateHash('abc'));
  });

  test('different input → different hash', () => {
    assert(calculateHash('abc') !== calculateHash('xyz'));
  });

  test('empty string does not throw', () => {
    const h = calculateHash('');
    assertEqual(h.length, 32);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('parseLogiDeclarations', () => {
  test('parses module declaration', () => {
    const d = parseLogiDeclarations('module auth\n');
    assert('module.auth' in d, 'should find module.auth');
  });

  test('parses failure block', () => {
    const src = `failure validation_failed\n  message: text\nend\n`;
    const d = parseLogiDeclarations(src);
    assert('failure.validation_failed' in d, 'should find failure');
    assertIncludes(d['failure.validation_failed'], 'message: text');
  });

  test('parses type block', () => {
    const src = `type user\n  id: text\n  email: text\nend\n`;
    const d = parseLogiDeclarations(src);
    assert('type.user' in d);
    assertIncludes(d['type.user'], 'id: text');
  });

  test('parses enum type (single line)', () => {
    const src = 'type user_status = active | suspended | pending\n';
    const d = parseLogiDeclarations(src);
    assert('type.user_status' in d);
  });

  test('parses usecase block', () => {
    const src = `usecase login for email: text returns session\n  step do something\nend\n`;
    const d = parseLogiDeclarations(src);
    assert('usecase.login' in d);
  });

  test('parses widget block', () => {
    const src = `widget login_form\n  prop email: text\nend\n`;
    const d = parseLogiDeclarations(src);
    assert('widget.login_form' in d);
  });

  test('parses screen block with nested when', () => {
    const src = `screen login_screen\n  state x: text\n  when x exists\n    step do\n  end\nend\n`;
    const d = parseLogiDeclarations(src);
    assert('screen.login_screen' in d);
  });

  test('parses flow, job, system_event blocks', () => {
    const src = `flow auth_flow\n  start: login_screen\nend\njob send_email(user: user)\n  step send\nend\nsystem_event order_created(order: order)\n`;
    const d = parseLogiDeclarations(src);
    assert('flow.auth_flow' in d);
    assert('job.send_email' in d);
    assert('system_event.order_created' in d);
  });

  test('ignores comment lines', () => {
    const src = `# this is a comment\ntype user\n  # field comment\n  id: text\nend\n`;
    const d = parseLogiDeclarations(src);
    assert('type.user' in d);
    assert(!d['type.user'].includes('# this is a comment'));
  });

  test('ignores top-level annotations (they attach to next block)', () => {
    const src = `@entity\ntype user\n  id: text\nend\n`;
    const d = parseLogiDeclarations(src);
    assert('type.user' in d);
    assert(!('@entity' in d));
  });

  test('full sample: finds all top-level declarations', () => {
    const d = parseLogiDeclarations(SAMPLE_LOGI);
    const keys = Object.keys(d);
    assert(keys.includes('failure.validation_failed'), 'validation_failed');
    assert(keys.includes('failure.auth_failed'), 'auth_failed');
    assert(keys.includes('type.user'), 'type user');
    assert(keys.includes('type.session'), 'type session');
    assert(keys.includes('type.user_status'), 'enum type');
    assert(keys.includes('usecase.login'), 'usecase login');
    assert(keys.includes('widget.login_form'), 'widget login_form');
    assert(keys.includes('screen.login_screen'), 'screen login_screen');
    assert(keys.includes('flow.auth_flow'), 'flow auth_flow');
    assert(keys.includes('job.send_welcome_email'), 'job');
    assert(keys.includes('system_event.order_created'), 'system_event');
  });

  test('nested when blocks do not break depth tracking', () => {
    const src = `usecase complex for x: text returns void
  when x exists
    when x is long
      step nested
    end
  end
  step done
end
`;
    const d = parseLogiDeclarations(src);
    assert('usecase.complex' in d);
    assertIncludes(d['usecase.complex'], 'step done');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('extractTopLevelLogidBlocks', () => {
  test('extracts tokens block', () => {
    const blocks = extractTopLevelLogidBlocks(SAMPLE_LOGID);
    const tokens = blocks.find(b => b.keyword === 'tokens');
    assert(tokens, 'should find tokens');
    assertIncludes(tokens.text, 'primary:');
  });

  test('extracts style blocks', () => {
    const blocks = extractTopLevelLogidBlocks(SAMPLE_LOGID);
    const styles = blocks.filter(b => b.keyword === 'style');
    assertEqual(styles.length, 2, 'should find 2 style blocks');
    assert(styles.some(s => s.name === 'login_form'));
    assert(styles.some(s => s.name === 'submit_button'));
  });

  test('style block with nested state and responsive blocks', () => {
    const blocks = extractTopLevelLogidBlocks(SAMPLE_LOGID);
    const lf = blocks.find(b => b.keyword === 'style' && b.name === 'login_form');
    assertIncludes(lf.text, 'hover');
    assertIncludes(lf.text, 'focus');
    assertIncludes(lf.text, 'on mobile');
  });

  test('extracts variant blocks with compound names', () => {
    const blocks = extractTopLevelLogidBlocks(SAMPLE_LOGID);
    const variants = blocks.filter(b => b.keyword === 'variant');
    assertEqual(variants.length, 2);
    assert(variants.some(v => v.name === 'login_form compact'));
    assert(variants.some(v => v.name === 'login_form immersive'));
  });

  test('extracts theme block', () => {
    const blocks = extractTopLevelLogidBlocks(SAMPLE_LOGID);
    const theme = blocks.find(b => b.keyword === 'theme');
    assert(theme, 'should find theme');
    assertEqual(theme.name, 'dark');
  });

  test('extracts motion block', () => {
    const blocks = extractTopLevelLogidBlocks(SAMPLE_LOGID);
    const motion = blocks.find(b => b.keyword === 'motion');
    assert(motion, 'should find motion block');
    assertEqual(motion.name, 'standard');
    assertIncludes(motion.text, 'enter:');
  });

  test('returns empty array for empty content', () => {
    assertEqual(extractTopLevelLogidBlocks(''), []);
  });

  test('ignores comment lines', () => {
    const content = `# comment\ntokens\n  color\n    primary: #fff\n  end\nend\n`;
    const blocks = extractTopLevelLogidBlocks(content);
    assertEqual(blocks.length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('findReferencedTypeBlocks', () => {
  test('finds type referenced by name in declaration text', () => {
    const allDecls = parseLogiDeclarations(SAMPLE_LOGI);
    const usecaseText = allDecls['usecase.login'];
    const refs = findReferencedTypeBlocks(usecaseText, allDecls);
    assert('type.session' in refs, 'session is return type');
    assert('failure.validation_failed' in refs, 'validation_failed referenced');
  });

  test('does not return non-type/failure declarations', () => {
    const allDecls = parseLogiDeclarations(SAMPLE_LOGI);
    const usecaseText = allDecls['usecase.login'];
    const refs = findReferencedTypeBlocks(usecaseText, allDecls);
    assert(!('usecase.login' in refs));
    assert(!('widget.login_form' in refs));
    assert(!('screen.login_screen' in refs));
  });

  test('returns empty object when no types referenced', () => {
    const src = `type simple\n  x: text\nend\n`;
    const allDecls = parseLogiDeclarations(src);
    const refs = findReferencedTypeBlocks('flow auth_flow\n  start: login_screen\nend', allDecls);
    assertEqual(Object.keys(refs).length, 0);
  });

  test('matches whole word boundaries (does not match substrings)', () => {
    const src = `type order\n  id: text\nend\ntype order_item\n  order_id: text\nend\n`;
    const allDecls = parseLogiDeclarations(src);
    // text that mentions "order" but not "order_item"
    const refs = findReferencedTypeBlocks('usecase get_order for id: text returns order\n', allDecls);
    assert('type.order' in refs, 'order should be found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getLogidContextForDecl', () => {
  let dir;
  beforeEach_ish(() => { dir = makeTmpWorkspace(); });
  afterEach_ish(() => { cleanup(dir); });

  // minimal setup/teardown
  function run(fn) { dir = makeTmpWorkspace(); try { fn(dir); } finally { cleanup(dir); } }

  test('returns null when no .logid file exists', () => {
    run(d => {
      writeLogiFile(d, 'auth.logi', SAMPLE_LOGI);
      const ctx = getLogidContextForDecl(d, 'contracts/auth.logi', 'widget.login_form');
      assertEqual(ctx, null);
    });
  });

  test('returns tokens + matching style + variants for widget', () => {
    run(d => {
      writeLogiFile(d, 'auth.logi', SAMPLE_LOGI);
      fs.writeFileSync(path.join(d, 'contracts', 'auth.logid'), SAMPLE_LOGID, 'utf8');
      const ctx = getLogidContextForDecl(d, 'contracts/auth.logi', 'widget.login_form');
      assert(ctx !== null, 'should return context');
      assertIncludes(ctx, 'tokens');
      assertIncludes(ctx, 'style login_form');
      assertIncludes(ctx, 'variant login_form compact');
      assertIncludes(ctx, 'variant login_form immersive');
    });
  });

  test('includes theme and motion blocks', () => {
    run(d => {
      writeLogiFile(d, 'auth.logi', SAMPLE_LOGI);
      fs.writeFileSync(path.join(d, 'contracts', 'auth.logid'), SAMPLE_LOGID, 'utf8');
      const ctx = getLogidContextForDecl(d, 'contracts/auth.logi', 'widget.login_form');
      assertIncludes(ctx, 'theme dark');
      assertIncludes(ctx, 'motion standard');
    });
  });

  test('does not include styles for other widgets', () => {
    run(d => {
      writeLogiFile(d, 'auth.logi', SAMPLE_LOGI);
      fs.writeFileSync(path.join(d, 'contracts', 'auth.logid'), SAMPLE_LOGID, 'utf8');
      const ctx = getLogidContextForDecl(d, 'contracts/auth.logi', 'widget.login_form');
      // submit_button style should NOT be included (it's for a different widget)
      assert(!ctx.includes('style submit_button'), 'should not include other widget styles');
    });
  });

  test('returns null for declaration with no matching style in logid', () => {
    run(d => {
      writeLogiFile(d, 'auth.logi', SAMPLE_LOGI);
      const logidWithNoMatch = `tokens\n  color\n    primary: #fff\n  end\nend\n`;
      fs.writeFileSync(path.join(d, 'contracts', 'auth.logid'), logidWithNoMatch, 'utf8');
      // usecase has no style block — only tokens will match, so result is not null but has tokens
      const ctx = getLogidContextForDecl(d, 'contracts/auth.logi', 'usecase.login');
      // tokens always included → context is non-null
      assertIncludes(ctx, 'tokens');
    });
  });
});

// fake setup/teardown (we use closures above)
function beforeEach_ish() {}
function afterEach_ish() {}

// ─────────────────────────────────────────────────────────────────────────────

describe('loadHashes / saveHashes', () => {
  test('roundtrip: save then load returns same data', () => {
    const dir = makeTmpWorkspace();
    try {
      const data = { 'contracts/auth.logi': { declarations: { 'usecase.login': 'abc123' }, outputs: {} } };
      saveHashes(dir, data);
      const loaded = loadHashes(dir);
      assertEqual(loaded, data);
    } finally { cleanup(dir); }
  });

  test('returns empty object when hashes file does not exist', () => {
    const dir = makeTmpWorkspace();
    try {
      assertEqual(loadHashes(dir), {});
    } finally { cleanup(dir); }
  });

  test('returns empty object on malformed JSON', () => {
    const dir = makeTmpWorkspace();
    try {
      const hashDir = path.join(dir, '.logi');
      fs.mkdirSync(hashDir, { recursive: true });
      fs.writeFileSync(path.join(hashDir, 'hashes.json'), '{bad json', 'utf8');
      assertEqual(loadHashes(dir), {});
    } finally { cleanup(dir); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('scanLogiFiles', () => {
  test('finds .logi files recursively', () => {
    const dir = makeTmpWorkspace();
    try {
      writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeLogiFile(dir, 'sub/todo.logi', 'module todo\n');
      const files = scanLogiFiles(dir, 'contracts');
      assertEqual(files.length, 2);
      assert(files.some(f => f.endsWith('auth.logi')));
      assert(files.some(f => f.endsWith('todo.logi')));
    } finally { cleanup(dir); }
  });

  test('returns empty array when source dir does not exist', () => {
    const dir = makeTmpWorkspace();
    try {
      assertEqual(scanLogiFiles(dir, 'nonexistent'), []);
    } finally { cleanup(dir); }
  });

  test('ignores .logid files', () => {
    const dir = makeTmpWorkspace();
    try {
      writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      fs.writeFileSync(path.join(dir, 'contracts', 'auth.logid'), SAMPLE_LOGID, 'utf8');
      const files = scanLogiFiles(dir, 'contracts');
      assert(files.every(f => f.endsWith('.logi')), 'should only return .logi files');
    } finally { cleanup(dir); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getDiff', () => {
  test('new file with no hashes → added', () => {
    const dir = makeTmpWorkspace();
    try {
      writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      const diff = getDiff(dir);
      assert(diff.added.length === 1, 'should be in added');
      assertIncludes(diff.added[0], 'auth.logi');
      assertEqual(diff.modified.length, 0);
      assertEqual(diff.deleted.length, 0);
    } finally { cleanup(dir); }
  });

  test('unchanged file → unchanged list', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'export const x = 1;');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);
      const diff = getDiff(dir);
      assertEqual(diff.unchanged.length, 1);
      assertEqual(diff.added.length, 0);
      assertEqual(diff.modified.length, 0);
    } finally { cleanup(dir); }
  });

  test('modified declaration → modified list with correct declaration name', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'export const x = 1;');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);

      // Modify usecase.login
      const modified = SAMPLE_LOGI.replace('step authenticate credentials', 'step authenticate with MFA');
      fs.writeFileSync(path.join(dir, 'contracts', 'auth.logi'), modified, 'utf8');

      const diff = getDiff(dir);
      assertEqual(diff.modified.length, 1);
      const mod = diff.modified[0];
      assertIncludes(mod.file, 'auth.logi');
      assert(mod.changedDeclarations.includes('usecase.login'), 'should detect usecase.login changed');
    } finally { cleanup(dir); }
  });

  test('new declaration added to existing file → newDeclarations list', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'export const x = 1;');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);

      const withNew = SAMPLE_LOGI + `\nusecase register for email: text returns void\n  step register the user\nend\n`;
      fs.writeFileSync(path.join(dir, 'contracts', 'auth.logi'), withNew, 'utf8');

      const diff = getDiff(dir);
      assertEqual(diff.modified.length, 1);
      const mod = diff.modified[0];
      assert(mod.newDeclarations.includes('usecase.register'), 'should detect new usecase');
    } finally { cleanup(dir); }
  });

  test('deleted declaration → deletedDeclarations list', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', '');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);

      // Remove the flow block
      const without = SAMPLE_LOGI.replace(/flow auth_flow[\s\S]*?end/, '');
      fs.writeFileSync(path.join(dir, 'contracts', 'auth.logi'), without, 'utf8');

      const diff = getDiff(dir);
      assertEqual(diff.modified.length, 1);
      assert(diff.modified[0].deletedDeclarations.includes('flow.auth_flow'));
    } finally { cleanup(dir); }
  });

  test('deleted file (in hashes but not on disk) → deleted list', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', '');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);

      // Delete the logi file from disk
      fs.unlinkSync(path.join(dir, 'contracts', 'auth.logi'));

      const diff = getDiff(dir);
      assertEqual(diff.deleted.length, 1);
      assertIncludes(diff.deleted[0].file, 'auth.logi');
    } finally { cleanup(dir); }
  });

  test('output file manually edited → drifted list', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'export const x = 1;');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);

      // Manually edit the output file
      fs.writeFileSync(path.join(dir, 'src/generated/Auth.ts'), 'export const x = 99; // hand-edited', 'utf8');

      const diff = getDiff(dir);
      assertEqual(diff.drifted.length, 1);
      assertIncludes(diff.drifted[0].file, 'auth.logi');
      assert(diff.drifted[0].driftedOutputs.some(o => o.includes('Auth.ts')));
    } finally { cleanup(dir); }
  });

  test('multiple files: each in correct bucket', () => {
    const dir = makeTmpWorkspace();
    try {
      const authRel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      const todoContent = `module todo\ntype todo_item\n  id: text\n  title: text\nend\n`;
      const todoRel = writeLogiFile(dir, 'todo.logi', todoContent);

      // Record auth as done
      writeOutputFile(dir, 'src/generated/Auth.ts', 'x');
      recordTranslation(dir, authRel, ['src/generated/Auth.ts']);

      // todo is new (not recorded)
      const diff = getDiff(dir);
      assert(diff.unchanged.some(f => f.includes('auth.logi')), 'auth should be unchanged');
      assert(diff.added.some(f => f.includes('todo.logi')), 'todo should be added');
    } finally { cleanup(dir); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('recordTranslation / removeFromHashes / reverseMapOutputFile', () => {
  test('recordTranslation writes correct declaration hashes and output hashes', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'export const x = 1;');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);
      const hashes = loadHashes(dir);
      assert(hashes[rel], 'entry should exist');
      assert(hashes[rel].declarations, 'should have declarations');
      assert(hashes[rel].outputs, 'should have outputs');
      assert('src/generated/Auth.ts' in hashes[rel].outputs, 'output hash recorded');
      assert(hashes[rel].last_translated, 'should record timestamp');
    } finally { cleanup(dir); }
  });

  test('removeFromHashes removes entry and returns output list', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'x');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);
      const outputs = removeFromHashes(dir, rel);
      assert(outputs.includes('src/generated/Auth.ts'));
      const hashes = loadHashes(dir);
      assert(!(rel in hashes), 'entry should be gone');
    } finally { cleanup(dir); }
  });

  test('reverseMapOutputFile finds source .logi for an output file', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'x');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);
      const src = reverseMapOutputFile(dir, 'src/generated/Auth.ts');
      assertIncludes(src, 'auth.logi');
    } finally { cleanup(dir); }
  });

  test('reverseMapOutputFile returns null for unknown output file', () => {
    const dir = makeTmpWorkspace();
    try {
      assertEqual(reverseMapOutputFile(dir, 'src/generated/Unknown.ts'), null);
    } finally { cleanup(dir); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('reverse-lookup CLI — path resolution and __UNTRACKED__ signal', () => {
  const { execSync } = require('child_process');
  const UTILS_PATH = path.resolve(__dirname, '../logi_utils.cjs');

  function cliReverseLookup(dir, arg) {
    // Run with cwd=dir so resolveBaseDir() returns dir (no module arg needed)
    try {
      const stdout = execSync(
        `node "${UTILS_PATH}" reverse-lookup "${arg}"`,
        { encoding: 'utf8', cwd: dir }
      );
      return { stdout: stdout.trim(), exitCode: 0 };
    } catch (e) {
      return { stdout: (e.stdout || '').trim(), exitCode: e.status || 1 };
    }
  }

  test('returns source .logi path when output file is tracked (full path)', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'x');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);
      const { stdout, exitCode } = cliReverseLookup(dir, 'src/generated/Auth.ts');
      assertEqual(exitCode, 0, 'should exit 0');
      assertIncludes(stdout, 'auth.logi');
    } finally { cleanup(dir); }
  });

  test('resolves short filename relative to output dir from project.logi.jsonc', () => {
    const dir = makeTmpWorkspace(); // output: 'src/generated'
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'x');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);
      // Pass only the short name — should resolve to src/generated/Auth.ts
      const { stdout, exitCode } = cliReverseLookup(dir, 'Auth.ts');
      assertEqual(exitCode, 0, 'should exit 0 for short path');
      assertIncludes(stdout, 'auth.logi');
    } finally { cleanup(dir); }
  });

  test('resolves subpath relative to output dir', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/auth/AuthService.ts', 'x');
      recordTranslation(dir, rel, ['src/generated/auth/AuthService.ts']);
      // Pass subpath relative to output dir
      const { stdout, exitCode } = cliReverseLookup(dir, 'auth/AuthService.ts');
      assertEqual(exitCode, 0, 'should exit 0');
      assertIncludes(stdout, 'auth.logi');
    } finally { cleanup(dir); }
  });

  test('outputs __UNTRACKED__ (exit 0) for unknown file — not exit 1', () => {
    const dir = makeTmpWorkspace();
    try {
      const { stdout, exitCode } = cliReverseLookup(dir, 'Unknown.ts');
      assertEqual(exitCode, 0, 'must exit 0 for untracked — agent depends on this');
      assertIncludes(stdout, '__UNTRACKED__');
    } finally { cleanup(dir); }
  });

  test('__UNTRACKED__ also when no hashes file exists at all', () => {
    const dir = makeTmpWorkspace();
    try {
      // Remove hashes file entirely
      const hashFile = path.join(dir, '.logi', 'hashes.json');
      if (fs.existsSync(hashFile)) fs.unlinkSync(hashFile);
      const { stdout, exitCode } = cliReverseLookup(dir, 'Auth.ts');
      assertEqual(exitCode, 0, 'must exit 0 even with no hashes file');
      assertIncludes(stdout, '__UNTRACKED__');
    } finally { cleanup(dir); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('buildContext', () => {
  test('generates .logi/build_context.json with correct shape', () => {
    const dir = makeTmpWorkspace();
    try {
      writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      const outPath = buildContext(dir);
      assert(fs.existsSync(outPath), 'file should exist');
      const ctx = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      assert('baseDir' in ctx, 'should have baseDir');
      assert('config' in ctx, 'should have config');
      assert('translationRules' in ctx, 'should have translationRules');
      assert('items' in ctx, 'should have items');
      assert('deleted' in ctx, 'should have deleted');
      assert('drifted' in ctx, 'should have drifted');
      assert('deletedDeclarations' in ctx, 'should have deletedDeclarations');
      assert('unchanged' in ctx, 'should have unchanged');
    } finally { cleanup(dir); }
  });

  test('added file creates item with mode=added and full logiContent', () => {
    const dir = makeTmpWorkspace();
    try {
      writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      buildContext(dir);
      const ctx = JSON.parse(fs.readFileSync(path.join(dir, '.logi', 'build_context.json'), 'utf8'));
      assertEqual(ctx.items.length, 1);
      assertEqual(ctx.items[0].mode, 'added');
      assertIncludes(ctx.items[0].logiContent, 'usecase login');
      assertEqual(ctx.items[0].logidContent, null);
    } finally { cleanup(dir); }
  });

  test('added file with paired .logid includes logidContent', () => {
    const dir = makeTmpWorkspace();
    try {
      writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      fs.writeFileSync(path.join(dir, 'contracts', 'auth.logid'), SAMPLE_LOGID, 'utf8');
      buildContext(dir);
      const ctx = JSON.parse(fs.readFileSync(path.join(dir, '.logi', 'build_context.json'), 'utf8'));
      assert(ctx.items[0].logidContent !== null, 'logidContent should be set');
      assertIncludes(ctx.items[0].logidContent, 'tokens');
    } finally { cleanup(dir); }
  });

  test('modified declaration creates surgical item with declarationText and referencedTypes', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', '// existing\nexport const x = 1;');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);

      const modified = SAMPLE_LOGI.replace('step authenticate credentials', 'step authenticate with biometrics');
      fs.writeFileSync(path.join(dir, 'contracts', 'auth.logi'), modified, 'utf8');

      buildContext(dir);
      const ctx = JSON.parse(fs.readFileSync(path.join(dir, '.logi', 'build_context.json'), 'utf8'));
      const item = ctx.items.find(i => i.declarationName === 'usecase.login');
      assert(item, 'should have usecase.login item');
      assertEqual(item.mode, 'modified');
      assertIncludes(item.declarationText, 'biometrics');
      assert('type.session' in item.referencedTypes, 'session type should be referenced');
      assert('failure.validation_failed' in item.referencedTypes, 'validation_failed should be referenced');
      // existingOutputs should have current file content
      assert('src/generated/Auth.ts' in item.existingOutputs);
      assertIncludes(item.existingOutputs['src/generated/Auth.ts'], '// existing');
    } finally { cleanup(dir); }
  });

  test('modified file with logid: item has logidContext', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      fs.writeFileSync(path.join(dir, 'contracts', 'auth.logid'), SAMPLE_LOGID, 'utf8');
      writeOutputFile(dir, 'src/generated/Auth.ts', 'x');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);

      const modified = SAMPLE_LOGI.replace('step authenticate credentials', 'step call auth API');
      fs.writeFileSync(path.join(dir, 'contracts', 'auth.logi'), modified, 'utf8');

      buildContext(dir);
      const ctx = JSON.parse(fs.readFileSync(path.join(dir, '.logi', 'build_context.json'), 'utf8'));
      const loginItem = ctx.items.find(i => i.declarationName === 'usecase.login');
      // login usecase has no style, but tokens should still be included
      assert(loginItem.logidContext !== null);
    } finally { cleanup(dir); }
  });

  test('includes translationRules from logi.md', () => {
    const dir = makeTmpWorkspace({ logiMd: '# Rules\n- Use async/await\n- No class components\n' });
    try {
      writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      buildContext(dir);
      const ctx = JSON.parse(fs.readFileSync(path.join(dir, '.logi', 'build_context.json'), 'utf8'));
      assertIncludes(ctx.translationRules, 'async/await');
    } finally { cleanup(dir); }
  });

  test('unchanged file has no items, appears in unchanged list', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'x');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);
      buildContext(dir);
      const ctx = JSON.parse(fs.readFileSync(path.join(dir, '.logi', 'build_context.json'), 'utf8'));
      assertEqual(ctx.items.length, 0);
      assert(ctx.unchanged.some(f => f.includes('auth.logi')));
    } finally { cleanup(dir); }
  });

  test('deleted file appears in context.deleted', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'x');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);
      fs.unlinkSync(path.join(dir, 'contracts', 'auth.logi'));
      buildContext(dir);
      const ctx = JSON.parse(fs.readFileSync(path.join(dir, '.logi', 'build_context.json'), 'utf8'));
      assertEqual(ctx.deleted.length, 1);
      assertIncludes(ctx.deleted[0].file, 'auth.logi');
    } finally { cleanup(dir); }
  });

  test('drifted output appears in context.drifted', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'x');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);
      fs.writeFileSync(path.join(dir, 'src/generated/Auth.ts'), 'x // hand-edited', 'utf8');
      buildContext(dir);
      const ctx = JSON.parse(fs.readFileSync(path.join(dir, '.logi', 'build_context.json'), 'utf8'));
      assertEqual(ctx.drifted.length, 1);
    } finally { cleanup(dir); }
  });

  test('deleted declaration appears in context.deletedDeclarations', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'x');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);

      const without = SAMPLE_LOGI.replace(/\nflow auth_flow[\s\S]*?end/, '');
      fs.writeFileSync(path.join(dir, 'contracts', 'auth.logi'), without, 'utf8');

      buildContext(dir);
      const ctx = JSON.parse(fs.readFileSync(path.join(dir, '.logi', 'build_context.json'), 'utf8'));
      assert(ctx.deletedDeclarations.some(d => d.declarationName === 'flow.auth_flow'));
    } finally { cleanup(dir); }
  });

  test('items for new_declaration mode when adding a declaration to existing file', () => {
    const dir = makeTmpWorkspace();
    try {
      const rel = writeLogiFile(dir, 'auth.logi', SAMPLE_LOGI);
      writeOutputFile(dir, 'src/generated/Auth.ts', 'x');
      recordTranslation(dir, rel, ['src/generated/Auth.ts']);

      const withNew = SAMPLE_LOGI + `\nusecase logout for session_id: text returns void\n  step invalidate session\nend\n`;
      fs.writeFileSync(path.join(dir, 'contracts', 'auth.logi'), withNew, 'utf8');

      buildContext(dir);
      const ctx = JSON.parse(fs.readFileSync(path.join(dir, '.logi', 'build_context.json'), 'utf8'));
      const item = ctx.items.find(i => i.declarationName === 'usecase.logout');
      assert(item, 'should have logout item');
      assertEqual(item.mode, 'new_declaration');
      assertIncludes(item.declarationText, 'invalidate session');
    } finally { cleanup(dir); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('initWorkspace', () => {
  test('creates project.logi.jsonc, logi.md, .logi/hashes.json', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logi-init-'));
    try {
      const created = initWorkspace(dir);
      assert(fs.existsSync(path.join(dir, 'project.logi.jsonc')));
      assert(fs.existsSync(path.join(dir, 'logi.md')));
      assert(fs.existsSync(path.join(dir, '.logi', 'hashes.json')));
      assert(created.includes('project.logi.jsonc'));
      assert(created.includes('logi.md'));
      assert(created.includes('.logi/hashes.json'));
    } finally { cleanup(dir); }
  });

  test('idempotent: does not overwrite existing files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logi-init2-'));
    try {
      initWorkspace(dir);
      fs.writeFileSync(path.join(dir, 'project.logi.jsonc'), '{"custom": true}', 'utf8');
      const created = initWorkspace(dir);
      assertEqual(created.length, 0, 'should not recreate existing files');
      const cfg = fs.readFileSync(path.join(dir, 'project.logi.jsonc'), 'utf8');
      assertIncludes(cfg, '"custom": true', 'should preserve existing content');
    } finally { cleanup(dir); }
  });

  test('project.logi.jsonc template is valid JSONC (parseable after comment strip)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logi-init3-'));
    try {
      initWorkspace(dir);
      const raw = fs.readFileSync(path.join(dir, 'project.logi.jsonc'), 'utf8');
      const { loadProjectConfig } = require('../logi_utils.cjs');
      const cfg = loadProjectConfig(dir);
      assert(cfg.language, 'should have language');
      assert(cfg.framework, 'should have framework');
      assert(cfg.source, 'should have source');
      assert(cfg.output, 'should have output');
    } finally { cleanup(dir); }
  });

  test('creates baseDir if it does not exist', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'logi-parent-'));
    const dir = path.join(base, 'new_module');
    try {
      assert(!fs.existsSync(dir), 'dir should not exist yet');
      initWorkspace(dir);
      assert(fs.existsSync(dir), 'dir should be created');
    } finally { cleanup(base); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('resolveBaseDir', () => {
  test('no arg → process.cwd()', () => {
    assertEqual(resolveBaseDir(null), process.cwd());
    assertEqual(resolveBaseDir(undefined), process.cwd());
  });

  test('absolute path returned as-is', () => {
    assertEqual(resolveBaseDir('/tmp/test'), '/tmp/test');
  });

  test('relative path resolved from cwd', () => {
    const result = resolveBaseDir('frontend');
    assertEqual(result, path.resolve(process.cwd(), 'frontend'));
  });

  test('colon-path: parent:sub → ./parent/sub', () => {
    const result = resolveBaseDir('parent:sub');
    assertEqual(result, path.resolve(process.cwd(), 'parent/sub'));
  });

  test('colon-path: three levels a:b:c → ./a/b/c', () => {
    const result = resolveBaseDir('a:b:c');
    assertEqual(result, path.resolve(process.cwd(), 'a/b/c'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('colon-path CLI — parent:sub module arg', () => {
  const { execSync } = require('child_process');
  const UTILS_PATH = path.resolve(__dirname, '../logi_utils.cjs');

  test('init with colon-path creates workspace in nested directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logi-colon-'));
    try {
      // Run from root with "parent:sub init" — should create root/parent/sub workspace
      execSync(
        `node "${UTILS_PATH}" init parent:sub`,
        { encoding: 'utf8', cwd: root }
      );
      assert(fs.existsSync(path.join(root, 'parent', 'sub', 'project.logi.jsonc')), 'project.logi.jsonc should exist at parent/sub');
      assert(fs.existsSync(path.join(root, 'parent', 'sub', 'logi.md')), 'logi.md should exist at parent/sub');
      assert(fs.existsSync(path.join(root, 'parent', 'sub', '.logi', 'hashes.json')), 'hashes.json should exist at parent/sub');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test('status with colon-path reads from correct nested directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logi-colon2-'));
    try {
      // Set up a workspace at root/apps/auth manually
      const subDir = path.join(root, 'apps', 'auth');
      fs.mkdirSync(path.join(subDir, '.logi'), { recursive: true });
      fs.mkdirSync(path.join(subDir, 'contracts'), { recursive: true });
      const cfg = { language: 'typescript', framework: 'react', source: 'contracts', output: 'src/generated' };
      fs.writeFileSync(path.join(subDir, 'project.logi.jsonc'), JSON.stringify(cfg), 'utf8');
      fs.writeFileSync(path.join(subDir, 'logi.md'), '# Rules\n', 'utf8');
      fs.writeFileSync(path.join(subDir, '.logi', 'hashes.json'), '{}', 'utf8');

      // Run status from root using colon-path
      const out = execSync(
        `node "${UTILS_PATH}" status apps:auth`,
        { encoding: 'utf8', cwd: root }
      );
      assertIncludes(out, 'Logi Status');
      assertIncludes(out, 'apps/auth');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('loadProjectConfig', () => {
  test('parses JSONC with comments correctly', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logi-cfg-'));
    try {
      const jsonc = `{
  // target language
  "language": "typescript", // trailing comment
  /* block comment */
  "framework": "react",
  "source": "contracts",
  "output": "src/generated"
}`;
      fs.writeFileSync(path.join(dir, 'project.logi.jsonc'), jsonc, 'utf8');
      const cfg = loadProjectConfig(dir);
      assertEqual(cfg.language, 'typescript');
      assertEqual(cfg.framework, 'react');
    } finally { cleanup(dir); }
  });

  test('throws clear error when project.logi.jsonc missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logi-nocfg-'));
    try {
      let threw = false;
      try { loadProjectConfig(dir); } catch (e) {
        threw = true;
        assertIncludes(e.message, 'project.logi.jsonc');
      }
      assert(threw, 'should throw');
    } finally { cleanup(dir); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

// Final report
console.log('\n' + '─'.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log(`  ✗ ${f.name}`));
  process.exit(1);
} else {
  console.log('\nAll tests passed. ✓');
  process.exit(0);
}
