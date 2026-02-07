# Contract-Driven Development (CDD)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

> **Human Architect, LLM Worker - The Best of Both Worlds**

## Why CDD Exists

Current AI-powered code generation solutions are fundamentally flawed for enterprise and commercial software development. They suffer from several critical issues:

### The AI Code Generation Problem

- **LLM Hallucinations**: Even the largest models with billions of parameters generate incorrect, fabricated code that looks plausible but doesn't work
- **Developer Complacency**: "Vibe coding" and AI dependency leads to developers reviewing less, assuming the AI is correct
- **Loss of Human Control**: Developers become passive prompters rather than active architects
- **Poor Reasoning**: LLMs struggle with complex architectural reasoning, system design, and long-term maintainability
- **Inconsistent Output**: Same prompt can generate different results, making builds unpredictable

### The Human Advantage

The human brain excels at:
- **Architectural Thinking**: Understanding complex system interactions and long-term implications
- **Reasoning & Logic**: Making informed decisions about trade-offs and design patterns
- **Domain Knowledge**: Understanding business requirements and context that LLMs cannot comprehend
- **Quality Assurance**: Critical thinking and systematic validation

### The Solution: Human Architect, LLM Worker

CDD restores human control while leveraging AI efficiency:
- **Human** defines contracts (the "what" and "why")
- **LLM** generates implementation (the "how")

This creates a development paradigm where humans are architects, not laborers, and LLMs are controlled workers that won't go wild.

## What is CDD?

Contract-Driven Development is a framework that puts human architects back in control of software development while harnessing AI for code generation.

### Core Philosophy

1. **Contracts First**: Humans define precise contracts that specify exactly what should be built
2. **AI Implementation**: LLMs generate code based on these contracts with strict guidelines
3. **Validation Layer**: The system ensures generated code matches contract specifications
4. **Universal Development**: Build Backends (Services/Data) AND Frontends (Screens/Navigation) using the same contract language.

## Quick Start

### Installation

CDD is designed to be universally compatible.

1. **Copy the CDD tool** to your project:
   - Copy the `.claude` folder.
   - Copy `cdd.bat` (Windows) and `cdd` (Unix) scripts to your root.
   - (Optional) Copy `.vscode` if using VS Code.

2. **Start using CDD**:

   **Claude Code CLI:**
   ```bash
   /cdd build
   ```

   **Gemini CLI / Terminal:**
   ```bash
   ./cdd build
   ```
   *Or just ask Gemini: "Run cdd build"*

   **VS Code / GitHub Copilot:**
   - Use **Terminal**: `./cdd build`
   - Use **Tasks**: Press `Ctrl+Shift+B` (or Cmd+Shift+B) -> Select `CDD: Build`

### Agent Compatibility

## The CDD Language (New!)

CDD has evolved to support full-stack development, including a "No-Code" style syntax for modern UI development (React, Compose, Flutter).

### 1. Backend & Data (The Core)
Standard definitions for entities and business logic.

```cdd
/** User entity */
data User {
  id: string
  name: string
  email: string
}

/** Business Logic Service */
service UserService {
  /** Create a new user */
  func createUser(user: User): User
}
```

### 2. Frontend & UI (The New "No-Code" Layer)
Define **Screens**, **Widgets**, and **Navigation Flows** without writing a single line of JSX or Kotlin.

#### **Screens (`screen`)**
Top-level pages/views. They hold **state** and **connect** to the backend.

```cdd
screen LoginScreen {
  // Local mutable state
  state email: string
  state isLoading: boolean

  // User interactions (Events)
  func onLoginClicked(): void
  
  // Wiring: When 'onLoginClicked' happens, call the API
  connect onLoginClicked -> UserService.login
}
```

#### **Widgets (`widget`)**
Reusable UI components. They receive **props** and emit events.

```cdd
widget Header {
  prop title: string
  func onBackClicked(): void
}
```

#### **Navigation (`flow`)**
Define the user journey using Arrow Syntax.

```cdd
flow AuthFlow {
  start: LoginScreen
  
  // Rules: Source.Event -> Destination
  route LoginScreen.onSuccess -> Dashboard
  route LoginScreen.onForgotPassword -> ResetPassword
}
```

## Designing with CDD

You can define the "Look and Feel" of your application using a special contract.

**Create `DesignSystem.cdd`:**
The AI detects this file and uses it to generate your global CSS, Tailwind Config, or Android Theme.

```cdd
/**
 * Global Design System.
 * 
 * THEME: Modern Minimalist.
 * COLORS: 
 * - Primary: #000000 (Black)
 * - Background: #FFFFFF (White)
 * - Accent: #FFD700 (Yellow)
 * 
 * SHAPES:
 * - Buttons: Sharp corners (radius: 0px).
 * - Inputs: Underlined only.
 */
data DesignSystem {
  theme: string
  darkMode: boolean
}
```

## Example: Building a Todo App

### 1. Define the Contract (`frontend/contracts/TodoApp.cdd`)

```cdd
/** Data Model */
data Todo {
  id: string
  title: string
}

/** Dashboard Screen */
screen TodoList {
  state items: Todo[]
  
  func onAdd(): void
  func onSelect(id: string): void

  // Auto-fetch data on load
  connect onMount -> TodoService.getAll
}

/** Edit Screen */
screen TodoEdit {
  prop id: string?
  
  func onSave(): void
  func onCancel(): void
  
  connect onSave -> TodoService.save
}

/** Navigation */
flow Main {
  start: TodoList
  
  route TodoList.onAdd -> TodoEdit
  route TodoList.onSelect -> TodoEdit
  route TodoEdit.onSave -> TodoList
  route TodoEdit.onCancel -> back
}
```

### 2. Build & Implement

Run the build command:
```bash
/cdd build
```

The AI will generate:
*   `src/screens/TodoList.tsx` (Complete with useEffect, useState, and API calls)
*   `src/screens/TodoEdit.tsx` (Complete form logic)
*   `src/navigation/AppRouter.tsx` (Complete React Router / Navigation setup)
*   `src/types/Todo.ts`

### 3. Verify & Hash

Once the code works, save the state:
```bash
/cdd hash
```

### Agent Compatibility

CDD works with **any AI model** configured in your development environment:

- ✅ **Claude Code** - Native support
- ✅ **Local LLMs** - Works immediately when configured in Claude Code (Ollama, LM Studio, etc.)
- ✅ **Open Source Models** - Llama, Mistral, and other capable models
- ✅ **Commercial Models** - Any model available through your AI platform
- 🚧 **Direct Integrations** - GitHub Copilot, Cursor, OpenAI Codex (coming soon)

### Cost-Effective Development

**No Expensive AI Required**: CDD works with any capable language model - you don't need premium, high-reasoning models with steep price tags:

- **Local LLMs**: Run models locally for complete privacy and cost control
- **Open Source Models**: Use capable open models that handle structured code generation
- **Smaller Commercial Models**: Cost-effective alternatives to flagship models
- **On-Premise Deployment**: Keep everything within your infrastructure

**Why CDD Works with Any Model**: The contract-based approach provides structured, specific instructions that don't require advanced reasoning. When you give an LLM precise contracts and clear implementation guidelines, even modest models can generate high-quality, consistent code.

CDD is a **Claude Code tool** that leverages whatever AI model you have configured, ensuring immediate compatibility with local and open source models.

### Setting Up Your Project

Create a `project.cdd` file in your project root to configure CDD:

```cdd
project {
  name: "MyApp"
  version: "1.0.0"

  modules {
    frontend {
      name: "Frontend App"
      language: "typescript"
      contracts: "frontend/contracts"
      output: "frontend/generated"
    }

    backend {
      name: "Backend App"
      language: "java"
      contracts: "backend/contracts"
      output: "backend/generated"
    }

    shared {
      name: "Shared Core"
      language: "typescript"
      contracts: "shared/contracts"
      output: "shared/generated"
    }
  }
}
```

### Module-Specific Instructions

Each module can have its own implementation guidelines by creating a `cdd.md` file in the module directory:

**Example Project Structure:**
```
my-project/
├── .claude/                    # CDD tool (copied from this repository)
│   ├── commands/
│   └── cdd.md                  # Main CDD commands
├── project.cdd                 # Project configuration
├── frontend/
│   ├── contracts/             # Frontend contract files
│   ├── cdd.md                 # Frontend implementation instructions
│   └── generated/             # Generated frontend code
├── backend/
│   ├── contracts/             # Backend contract files
│   ├── cdd.md                 # Backend implementation instructions
│   └── generated/             # Generated backend code
└── shared/
    ├── contracts/             # Shared contract files
│   ├── cdd.md                 # Shared module instructions
│   └── generated/             # Generated shared code
```

### Module Instructions Example

**backend/cdd.md:**
```markdown
# Backend Module Implementation Instructions

## Module Configuration
- **Language**: Java
- **Framework**: Spring Boot
- **Output Directory**: backend/generated/

## Package Structure Requirements
- **CRITICAL**: Match the contract's package structure in generated code
- Extract package from contract path: `contracts/com/acf/testing/Contract.cdd` → package `com.acf.testing`
- Create generated files under: `generated/com/acf/testing/`
- **Every Java file must have correct package declaration**: `package com.acf.testing;`

## Implementation Requirements
- Create Spring Boot services with proper annotations
- Use JPA annotations for database mapping
- Include proper error handling and validation
```

**frontend/cdd.md:**
```markdown
# Frontend Module Implementation Instructions

## Module Configuration
- **Language**: TypeScript
- **Framework**: React
- **Output Directory**: frontend/generated/

## Implementation Requirements
- Create React components with proper props and state
- Use React hooks and functional components
- Include proper TypeScript typing for React
- Add proper error handling and validation
```

### Creating Your First Contract

1. **Create a contract file** in your module's contracts directory:

```cdd
// backend/contracts/UserService.cdd

component UserService {
  description: "Manages user accounts and authentication"

  func createUser(user: User): User {
    description: "Create a new user account"
  }

  func getUserById(userId: string): User? {
    description: "Get user by ID"
  }
}

data User {
  description: "User entity"
  id: string
  name: string
  email: string
  createdAt: datetime
}
```

2. **Run CDD build** to analyze contracts:
```bash
/cdd build
```

3. **Follow the generated instructions** to implement the code

4. **Generate hashes** when complete:
```bash
/cdd hash
```

That's it! You now have CDD set up in your project with module-specific instructions and contracts.

### Basic Usage

1. **Analyze Contracts**
```bash
/cdd build
```

2. **Generate Hashes** (after implementing contracts)
```bash
/cdd hash
```

3. **Check Status**
```bash
/cdd status
```

4. **Clean Build** (remove all generated code)
```bash
/cdd clean-build
```

## Writing Contracts

### Contract Structure

Contracts are written in a simple DSL that defines data structures, components, and aspects:

```cdd
// User Management Contract

component UserService {
  description: "Manages user accounts and authentication"

  func createUser(user: User): User {
    description: "Create a new user account"
  }

  func getUserById(userId: string): User? {
    description: "Get user by ID"
  }

  func updateUser(userId: string, user: User): User {
    description: "Update user information"
  }
}

data User {
  description: "User entity"
  id: string
  name: string
  email: string
  passwordHash: string
  createdAt: datetime
  updatedAt: datetime
}

aspect Validation {
  description: "Validates input data for all operations"
  before "component.*" {
    description: "Validate all input parameters"
  }
}
```

### Contract Elements

- **Data**: Entity definitions with fields and types
- **Components**: Service/business logic interfaces
- **Aspects**: Cross-cutting concerns (validation, logging, etc.)

## Module Configuration

### project.cdd

Define project structure and modules:

```cdd
project {
  name: "MyApp"
  version: "1.0.0"

  modules {
    frontend {
      name: "Frontend App"
      language: "typescript"
      contracts: "frontend/contracts"
      output: "frontend/generated"
    }

    backend {
      name: "Backend App"
      language: "java"
      contracts: "backend/contracts"
      output: "backend/generated"
    }
  }
}
```

### Module Instructions

Each module has a `cdd.md` file with implementation guidelines:

**backend/cdd.md**
```markdown
# Backend Module Implementation Instructions

## Package Structure Requirements
- Extract package from contract path: `contracts/com/acf/testing/Contract.cdd` → package `com.acf.testing`
- Create generated files under: `generated/com/acf/testing/`
- **Every Java file must have correct package declaration**: `package com.acf.testing;`

## Implementation Requirements
- Create Spring Boot services with proper annotations
- Use JPA annotations for database mapping
- Include proper error handling and validation
```

## Advanced Features

### Package Structure Preservation

CDD automatically preserves Java package structures:

- Contract: `backend/contracts/com/company/app/UserService.cdd`
- Generated: `backend/generated/com/company/app/UserService.java`
- Package: `package com.company.app;`

### Clean Build Management

```bash
# Clean all generated files
/cdd clean

# Clean and rebuild everything
/cdd clean-build
```

### Multi-Framework Projects

Support different frameworks per module:

- **Frontend**: TypeScript + React
- **Backend**: Java + Spring Boot
- **Shared**: TypeScript + Node.js

### Change Detection

CDD uses hash-based change detection:

- Only regenerates modified contracts
- Preserves existing implementations
- Prevents unnecessary regeneration

## Commands Reference

| Command | Description |
|---------|-------------|
| `build` | Analyze contracts and prepare implementation |
| `hash` | Generate hashes for implemented contracts |
| `status` | Show contract status report |
| `clean` | Clean build and generated directories |
| `clean-build` | Clean and then rebuild all contracts |

## Example Workflows

### 1. New Feature Development

1. Write/modify contract files
2. Run `/cdd build` to analyze changes
3. Review generated instructions
4. Implement code following guidelines
5. Run `/cdd hash` to mark as complete

### 2. Refactoring Existing Code

1. Modify contracts to reflect new requirements
2. Run `/cdd build` to see what needs updating
3. Update generated code following new structure
4. Run `/cdd hash` to update hashes

### 3. Complete Regeneration

1. Run `/cdd clean-build` to remove everything
2. Regenerate all code from contracts
3. Run `/cdd hash` to create new hashes

## Configuration Options

### Project Configuration

- **name**: Project name
- **version**: Project version
- **modules**: Module definitions
- **dependencies**: Inter-module dependencies
- **paths**: Custom directory paths
- **plugins**: Feature toggles

### Module Configuration

- **name**: Module display name
- **language**: Programming language
- **contracts**: Contract files directory
- **output**: Generated code directory

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Areas for Contribution

- **New Language Support**: Python, Go, C#, etc.
- **Additional Frameworks**: Django, ASP.NET, etc.
- **IDE Integration**: VS Code, IntelliJ plugins
- **Validation Tools**: Automated contract validation
- **Documentation**: Improve examples and guides

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Roadmap

### Upcoming Features

- [ ] **Direct Agent Integrations**: Native GitHub Copilot, Cursor, OpenAI Codex support
- [ ] **IDE Plugins**: VS Code and IntelliJ integration
- [ ] **Visual Contract Editor**: GUI for creating contracts
- [ ] **Contract Validation**: Automated validation and testing
- [ ] **More Languages**: Python, Go, C#, Rust support
- [ ] **Advanced Aspects**: Caching, security, monitoring aspects
- [ ] **Contract Testing**: Automated testing of generated code
- [ ] **Documentation Generation**: Auto-generate API docs from contracts
- [ ] **Migration Tools**: Import from OpenAPI, GraphQL schemas
- [ ] **Team Collaboration**: Contract review and approval workflows
- [ ] **Performance Monitoring**: Track generation performance and quality

### Future Vision

- **Enterprise-Grade Contract Management**
- **Real-time Contract Collaboration**
- **Advanced Code Quality Analysis**
- **Integration with CI/CD Pipelines**
- **Contract Versioning and Evolution**
- **AI-Assisted Contract Writing**

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

## Philosophy

### Human-Centric Development

CDD is built on the principle that humans should remain firmly in control of software architecture and design. AI should be a tool that accelerates implementation, not a replacement for human reasoning and creativity.

### Quality Over Speed

While AI can generate code quickly, quality requires human oversight. CDD ensures that every generated component is based on well-defined contracts that humans create and validate.

### Sustainable Development

By creating clear contracts and maintaining consistent code generation, CDD helps build sustainable, maintainable software that can evolve over time without architectural drift.

---

**Join us in building the future of human-AI collaborative development!**