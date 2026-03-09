---
name: e2egen
description: Generates CDD e2e tests and page objects from natural language descriptions by exploring the application in a real browser.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: automated-testing
---

# CDD Generation Skill (cddgen)

This skill enables you to autonomously generate Contract-Driven Development (CDD) artifacts for end-to-end (E2E) testing. You will take a high-level user description, explore the application using a browser to understand the flow and selectors, and then generate the necessary CDD contracts and data files. Finally, you will run the CDD build command to generate the executable Playwright code.

## Workflow

1.  **Analyze Request**: Understand the user's natural language goal (e.g., "Login and check the dashboard").
2.  **Browser Exploration**: Use Playwright tools to perform the actions in a real browser instance.
    *   Launch the browser.
    *   Navigate to the application URL.
    *   Inspect elements to find robust selectors (prioritizing `data-testid`, `role`, `label`, `placeholder`, `text`).
    *   Capture the sequence of actions (clicks, fills, navigations).
    *   Identify necessary test data.
3.  **Consultation (CRITICAL)**:
    *   Based on your exploration, **list the test scenarios** you plan to generate.
    *   Example:
        > I have identified the following test cases for the "Login" flow:
        > 1.  **Successful Login**: User logs in with valid credentials and lands on the Dashboard.
        > 2.  **Invalid Login**: User attempts to log in with invalid credentials and sees an error message.
    *   **Ask the user**: "Do these test cases cover your intent? Should I add or remove any scenarios?"
    *   **Wait** for the user's confirmation before proceeding.
4.  **CDD Contract Generation**:
    *   **Page Objects (`e2e/contracts/pages/*.page.cdd`)**: Create or update page object contracts.
        *   Define `component PageName`.
        *   Define `state locatorName: Locator` for each interacted element.
        *   Use `/** selector: ... */` comments for specific selectors found during exploration.
    *   **Scenarios (`e2e/contracts/scenarios/*.test.cdd`)**: Create a test scenario contract.
        *   Define `component FeatureName`.
        *   Define `func testScenarioName()`.
        *   Write the `description: """ ... """` block using CDD DSL (Gherkin-like steps).
        *   Reference data files if needed.
    *   **Data (`e2e/data/*.json`)**: Create JSON data files for input values.
        *   Use `{{factory:*}}` tokens where appropriate (e.g., unique emails).
5.  **Build & Verify**:
    *   Run `/cdd e2e:build` to generate the Playwright code.
    *   (Optional) Run the generated test to verify it passes.

## Detailed Rules & Guidelines

### 1. Page Object Rules (`.page.cdd`)

*   **File Naming**: `e2e/contracts/pages/<PageName>.page.cdd`
*   **Structure**:
    ```cdd
    component LoginPage {
      state emailInput: Locator
      /** selector: [data-testid="submit-btn"] */
      state submitBtn: Locator
    }
    ```
*   **Selector Priority**:
    1.  `/** selector: ... */` (Explicit) - Use if you find a stable attribute like `data-testid`.
    2.  `role` (e.g., button, link) - Implicitly handled by LLM, but verify uniqueness.
    3.  `label` / `placeholder` - Good for form fields.
    4.  `text` - Use for buttons or links with unique text.
    5.  `css` / `xpath` - Avoid unless absolutely necessary.

### 2. Scenario Rules (`.test.cdd`)

*   **File Naming**: `e2e/contracts/scenarios/<FeatureName>.test.cdd`
*   **Structure**:
    ```cdd
    component LoginFlow {
      description: "uses page LoginPage from ../pages/Login.page.cdd"
    
      @smoke
      func testValidLogin() {
        description: """
          scenario "Valid Login" uses data from ../../data/login.data.json
          given the user navigates to the login page
          when the user fills emailInput with '{data.email}'
          and clicks submitBtn
          then wait for url contains '/dashboard'
        """
      }
    }
    ```
*   **DSL Keywords**:
    *   `uses page <PageName> from <Path>`
    *   `uses data from <Path>`
    *   `fill <locator> with <value>`
    *   `click <locator>`
    *   `wait for <condition>` (url, visible, networkidle)
    *   `snapshot visual "<name>"`

### 3. Data Rules (`.json`)

*   **File Naming**: `e2e/data/<FeatureName>.data.json`
*   **Structure**: Array of objects.
    ```json
    [
      {
        "caseName": "Valid Login",
        "email": "user@example.com",
        "password": "secure"
      }
    ]
    ```
*   **Factory Tokens**:
    *   `{{factory:email}}` -> Generates unique email.
    *   `{{factory:uuid}}` -> Generates UUID.
    *   `{{factory:firstName}}` -> Generates random name.

## Instructions for the Agent

When you receive a request:

1.  **Launch Browser**: Start by opening the application URL using `playwright_browser_navigate`.
2.  **Execute & Observe**: Perform the user's requested actions step-by-step using tools like `playwright_browser_click`, `playwright_browser_fill_form`, etc.
    *   *Crucial*: Note the **exact** selectors for every element you interact with.
    *   *Crucial*: Note the **data** you type into forms.
    *   *Crucial*: Note the **URL changes** and **network activity** to define wait conditions.
3.  **Propose Test Plan**: Stop and present the user with the test scenarios you have formulated based on your exploration. Ask for confirmation.
4.  **Draft Files**:
    *   Check if `e2e/contracts/pages/` already contains a relevant page object. If yes, update it. If no, create a new one.
    *   Create a new scenario file in `e2e/contracts/scenarios/`.
    *   Create a data file in `e2e/data/` if inputs are complex.
5.  **Write Files**: Use the `Write` tool to save these files to disk.
6.  **Generate Code**: Run the command:
    ```bash
    /cdd e2e:build
    ```
7.  **Report**: Confirm to the user that the tests have been generated and built. Provide the path to the generated files.
