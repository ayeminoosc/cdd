# UI Test Automation Module Instructions

## Module Configuration
- **Framework**: Playwright
- **Output Path**: `e2e/test`
- **Page Contract Path**: `e2e/contracts/*/pages`
- **Scenario Contract Path**: `e2e/contracts/*/scenarios`
- **Setup Contract Path**: `e2e/contracts/*/setup`
- **Component Contract Path**: `e2e/contracts/*/components`
- **Page Object Path**: `e2e/test/pages`
- **Test Spec Path**: `e2e/test`
- **Fixtures Path**: `e2e/lib/fixtures`
- **Auth State Path**: `e2e/.auth`

---
## **PHASE 0: GLOBAL SETUP GENERATION**

Process `component` blocks found in the **Setup Contract Path** (`e2e/contracts/setup/`).

### **Rule: Auth Setup Detection**
- Detect any `component` whose top-level `description` starts with `"auth setup:"`.
- Generate `e2e/lib/setup/global-setup.ts` — a standard Playwright `globalSetup` function that logs in once and saves the browser storage state.
- Generate `e2e/lib/fixtures/auth.fixture.ts` that extends `test` with an `authenticatedPage` fixture applying `storageState: process.env.STORAGE_STATE_PATH`.

### **Rule: Environment Variables**
- All URLs and credentials in generated setup files MUST be read from `process.env.*` — never hardcoded.
- The project uses `.env.{ENV}` files loaded via `dotenv` in `playwright.config.ts`. `ENV` defaults to `local`.
- Standard env vars: `BASE_URL`, `PLATFORM_URL`, `AUTH_EMAIL`, `AUTH_PASSWORD`, `STORAGE_STATE_PATH`.

### **Rule: Authenticated Fixture Usage**
- Scenario contracts with `uses auth` in their component `description` must import `{ test, expect }` from `'../../lib/fixtures/auth.fixture'` instead of `'@playwright/test'`.
- These specs receive the `authenticatedPage` fixture (destructured as `page`) which carries a pre-authenticated session — no login steps needed inside the test.

---
## **PHASE 1: PAGE OBJECT GENERATION**

Process `component` blocks found in the **Page Contract Path** (`e2e/contracts/pages/`).

### **Rule: Contract-to-Class Mapping**
- For each `component SomeName` contract, generate a `SomeName.ts` file in the Page Object Path.
- The class name will be `SomeName`.
- The class must export `SomeName` as a named export.

### **Rule: 'state' fields to Locators — Selector Priority Chain**
For each `state name: Locator` field, create a `readonly name: Locator;` property.
Initialize it using this **priority order** — use the first strategy that applies:

1. **Explicit hint** — if a doc comment `/** selector: ... */` appears directly above the `state` line, use that selector verbatim.
2. **`getByTestId`** — if the field name maps to a `data-testid` pattern (e.g. `emailInput` → `getByTestId('email-input')`).
3. **`getByRole`** — for interactive elements: buttons, links, checkboxes (e.g. `submitBtn` → `getByRole('button', { name: '...' })`).
4. **`getByLabel`** — for labeled form inputs.
5. **`getByPlaceholder`** — for inputs with placeholder text.
6. **`getByText`** — for text-content elements.
7. **CSS/XPath** — last resort only. **Never use a CSS selector as the first choice.**

Doc comment hints are used **verbatim**, bypassing the priority chain entirely:
```
/** selector: [data-testid="email-input"] */
state emailInput: Locator
// → page.locator('[data-testid="email-input"]')

/** selector: role=button[name="Sign in"] */
state signinBtn: Locator
// → page.getByRole('button', { name: 'Sign in' })
```

### **Rule: Wait / Stability Vocabulary**
Translate these phrases inside any `func description:` block into Playwright wait commands:

| Contract phrase | Generated Playwright code |
|---|---|
| `wait for networkidle` | `await page.waitForLoadState('networkidle')` |
| `wait for url contains X` | `await page.waitForURL(/X/)` |
| `wait for navigation` | `await page.waitForLoadState('domcontentloaded')` |
| `wait for element visible: locatorName` | `await this.locatorName.waitFor({ state: 'visible' })` |
| `wait for element hidden: locatorName` | `await this.locatorName.waitFor({ state: 'hidden' })` |
| `wait for api response /path/` | `await page.waitForResponse(r => r.url().includes('/path/'))` |
| `wait for timeout Nms (debug only)` | `await page.waitForTimeout(N)` |

**RULE**: `await page.waitForTimeout()` is **forbidden** in generated code unless the description explicitly includes `(debug only)`. Use semantic waits instead.

### **Rule: Network Mock / Route Vocabulary**
Translate these phrases inside any `func description:` block into Playwright route interception:

| Contract phrase | Generated Playwright code |
|---|---|
| `mock GET /api/path returns fixture "file.json"` | `await page.route('**/api/path', r => r.fulfill({ path: 'e2e/lib/fixtures/file.json' }))` |
| `mock POST /api/path returns status 422` | `await page.route('**/api/path', r => r.fulfill({ status: 422, body: '{}' }))` |
| `mock GET /api/path returns status 500` | `await page.route('**/api/path', r => r.fulfill({ status: 500, body: '{}' }))` |
| `intercept GET /api/path as varName` | `const varName = page.waitForResponse(r => r.url().includes('/api/path'))` |
| `await varName` | `const response = await varName` |
| `abort GET /api/path` | `await page.route('**/api/path', r => r.abort())` |

**RULE**: When `mock ... returns fixture "file.json"` is used, create a stub `e2e/lib/fixtures/file.json` with `{}` if the file does not already exist.

### **Rule: 'func' definitions to Methods**
- For each `func actionName(...)` method, create a corresponding `async actionName(...)` method in the class.
- Translate the `description` steps into Playwright commands using the Wait, Mock, and Selector rules above.
- Example: `fill emailInput with email` → `await this.emailInput.fill(email);`

---
## **PHASE 2: TEST SPEC GENERATION**

Process `component` blocks found in the **Scenario Contract Path** (`e2e/contracts/scenarios/`).

### **Rule: Test Logic Generation**
- For each `component SomeFlow` contract, generate a `some-flow.spec.ts` file in the Test Spec Path.
- The component `description` may contain `uses page ...`. Import the referenced Page Object.
- If the component `description` contains `uses auth`, import `{ test, expect }` from `'../../lib/fixtures/auth.fixture'` instead of `'@playwright/test'`.

### **Rule: Annotations (@) on func blocks**
Lines starting with `@` immediately before a `func` declaration are **annotations**. Parse and apply:

| Annotation syntax | Generated Playwright code |
|---|---|
| `@smoke` | `test('name', { tag: '@smoke' }, async ...)` |
| `@regression` | `test('name', { tag: '@regression' }, async ...)` |
| `@owner("team")` | `test.info().annotations.push({ type: 'owner', description: 'team' })` inside test |
| `@jira("TICKET-123")` | `test.info().annotations.push({ type: 'jira', description: 'TICKET-123' })` inside test |

Multiple tags on one func stack into the tags array: `{ tag: ['@smoke', '@regression'] }`.

### **Rule: 'func' definitions to Test Scenarios**
- Each `func scenarioName()` represents a test scenario.
- **If `uses data ...` is present**:
  - **DO NOT** import JSON data files directly.
  - Use the `loadTestData` helper from `'../../lib/helpers/dataLoader'` to load environment-aware data.
  - Example: `const dataSet = loadTestData('signin.data');`
  - This helper automatically calls `resolveFactories(data)`, so explicit resolution in the spec is NOT required for bulk data.
  - Generate a data-driven loop: `for (const data of dataSet) { test(data.caseName, ...) }`.
- **If no `uses data`**: generate a single `test('scenarioName', ...)` block.

### **Rule: cleanup: field**
If a `func` block contains a `cleanup: "METHOD /api/path/{data.field}"` line, generate a `test.afterEach` that calls `request.delete/post/...` using the `APIRequestContext` fixture:
```typescript
test.afterEach(async ({ request }) => {
  await request.delete(`${process.env.BASE_URL}/api/path/${resolvedData.field}`);
});
```

### **Rule: Data Factory Tokens**
JSON data values may contain factory tokens. These are automatically resolved by `loadTestData`. If manual resolution is needed for inline objects, import `resolveFactories` from `'../../lib/helpers/factory'`:

| Token | Resolved value |
|---|---|
| `{{factory:email}}` | `` `test_${Date.now()}@example.com` `` |
| `{{factory:uuid}}` | `crypto.randomUUID()` |
| `{{factory:firstName}}` | A random first-name string |
| `{{timestamp}}` | `Date.now().toString()` |

### **Rule: Data Inheritance with $extends**
JSON data files support inheritance to reduce duplication:

**Parent file** (`data/common/user-base.data.json`):
```json
{
  "firstName": "Test",
  "lastName": "User",
  "password": "TestPass123!"
}
```

**Child file** (`data/signin.data.json`):
```json
[
  {
    "$extends": "./common/user-base.data.json",
    "caseName": "Valid Signin",
    "email": "test@example.com"
  }
]
```

**Resolved output**:
```json
{
  "firstName": "Test",
  "lastName": "User",
  "password": "TestPass123!",
  "caseName": "Valid Signin",
  "email": "test@example.com"
}
```

#### Excluding Parent Fields

Use `$exclude` to remove inherited fields:
```json
{
  "$extends": "./common/user-base.data.json",
  "$exclude": ["password"],
  "caseName": "Login without password"
}
```

Or set fields to `null` to explicitly remove them:
```json
{
  "$extends": "./common/user-base.data.json",
  "password": null,
  "caseName": "Login without password"
}
```

#### Resolution Rules
- Paths in `$extends` are relative to the data directory
- `$extends` is processed before `$exclude`
- `null` values remove inherited fields
- Factory tokens `{{factory:*}}` are resolved after all extends are merged
- Circular extends detection is enabled to prevent infinite loops

### **Rule: Extended Assertion Vocabulary**
Translate these phrases in any `func description:` into assertion code:

| Contract phrase | Generated code |
|---|---|
| `snapshot visual "name"` | `await expect(page).toHaveScreenshot('name.png')` |
| `check accessibility` | `await injectAxe(page); await checkA11y(page)` — adds `import { checkA11y, injectAxe } from 'axe-playwright'` at top of file and a `// requires: npm i -D axe-playwright` comment |
| `measure load time < Nms` | `const _t0 = Date.now();` before navigation, `expect(Date.now() - _t0).toBeLessThan(N);` after |
| `check no console errors` | Attach `page.on('console', msg => ...)` listener in `beforeEach`, assert the errors array is empty at end of test |

### **Rule: Mapping Steps to Actions**
- `given the user navigates...` → `await page.navigateTo();`
- `when the user logs in...` → `await signinPage.login(data.email, data.password);`
- `then check result...` → Generate conditional assertions based on data fields present.

---
## **PHASE 3: COMPONENT TEST GENERATION**

Process `component` blocks found in the **Component Contract Path** (`e2e/contracts/components/`).

### **Rule: Component Test Detection**
- Detect any `component` whose top-level `description` starts with `"component test: "`.
- The path after `"component test: "` is the source component file under test.
- Generate `*.spec.tsx` (not `.ts`) files in `e2e/test/component/`.

### **Rule: Component Test Implementation**
- Use `import { mount } from '@playwright/experimental-ct-react'`.
- `mount()` the target component with props described in the `func description:`.
- **RULE**: Component tests NEVER use `page.goto()`. If translation would produce a `goto`, add a `// WARNING: component tests use mount(), not page.goto()` comment and correct to `mount()`.
- A `// requires: npm i -D @playwright/experimental-ct-react` comment must appear at the top of every generated component spec.

#### **TODO: E2E Framework Enhancements**
The following DSL vocabulary and generation rules are planned:
- [ ] **File Uploads**: `upload file "path" to locatorName` support.
- [ ] **Drag & Drop**: `drag sourceLocator to targetLocator` support.
- [ ] **Clipboard**: `expect clipboard to contain "text"` support.
- [ ] **Downloads**: `wait for download` support.
- [ ] **Keyboard**: `press "Key"` support for special keys (Enter, Escape, etc.).
- [ ] **Hover**: `hover over locatorName` support.

## Designing with CDD
