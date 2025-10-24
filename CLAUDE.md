# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Contract-Driven Development (CDD)** project that uses a custom DSL (Domain Specific Language) to define software contracts and automatically generates implementation instructions across multiple modules. The system supports different programming languages and frameworks within a single monorepo.

## Key Architecture

### Multi-Module Structure
```
project-root/
├── .claude/commands/          # CDD CLI implementation
├── .cdd/                    # CDD cache and hash storage (tracked in Git)
├── build/                    # Build artifacts (temporary, regenerated)
├── frontend/                # Frontend module (TypeScript + React)
│   ├── contracts/           # Contract definitions
│   └── generated/            # Generated code (tracked in Git)
├── backend/                 # Backend module (Java + Spring)
│   ├── contracts/           # Contract definitions
│   └── generated/            # Generated code (tracked in Git)
└── shared/                  # Shared module (TypeScript + Node)
    ├── contracts/           # Contract definitions
    └── generated/            # Generated code (tracked in Git)
```

### CDD Workflow
1. **Define Contracts**: Write contracts in `.cdd` files using the CDD DSL
2. **Build Command**: `/cdd build` analyzes contracts and generates implementation context
3. **Generate Code**: Claude creates implementation files in module-specific `generated/` directories
4. **Hash Updates**: `/cdd hash` updates hashes to track implemented contracts
5. **Change Detection**: Subsequent builds detect changes and only generate modified/new code

### Contract-Driven Architecture
- **Contracts**: Define data structures, components/services, and cross-cutting concerns
- **Multi-Module Support**: Each module can use different languages/frameworks
- **Hash-Based Tracking**: MD5 hashes track contract changes for incremental builds
- **Framework-Aware Generation**: Implementation instructions respect module-specific patterns

## Essential Commands

### Primary CDD Workflow
```bash
# Analyze all contracts and prepare implementation instructions
/cdd build

# Build specific module only
/cdd build frontend
/cdd build backend
/cdd build shared

# After implementing contracts, update hashes
/cdd hash

# Check contract status across all modules
/cdd status
```

### Development Commands
```bash
# Test CDD build using node wrapper (if slash command unavailable)
node .claude/commands/cdd_wrapper.js build

# Debug contract discovery and parsing
node .claude/commands/cdd_wrapper.js status

# Reset hashes (useful for testing)
rm .cdd/hashes.csv
```

## Configuration Files

### project.cdd
Defines module structure, languages, frameworks, and dependencies:
```cdd
project {
  name: "ProjectName"
  version: "1.0.0"
  language: "typescript"  // Default language
  framework: "express"   // Default framework

  modules {
    frontend {
      name: "Frontend App"
      language: "typescript"
      framework: "react"
      contracts: "frontend/contracts"
      output: "frontend/generated"
    }
    backend {
      name: "Backend App"
      language: "java"
      framework: "spring"
      contracts: "backend/contracts"
      output: "backend/generated"
    }
    shared {
      name: "Shared Core"
      language: "typescript"
      framework: "node"
      contracts: "shared/contracts"
      output: "shared/generated"
    }
  }

  dependencies {
    frontend: [shared]
    backend: [shared]
  }
}
```

### .gitignore
Critical paths:
```
# CDD Build Artifacts (regenerated)
build/

# Node dependencies
node_modules/

# IDE and OS files
.vscode/
.idea/
.DS_Store
Thumbs.db
```

## Contract DSL Structure

### Basic Contract Syntax
```cdd
// Data entities with field types and validation
data User {
  id: string
  name: string
  email: string
  passwordHash: string
  createdAt: datetime
  updatedAt: datetime
}

// Components with methods and error handling
component UserService {
  description: "Manages user accounts and authentication"

  func createUser(user: User): User {
    description: "Create a new user account"
  }

  func getUserById(userId: string): User? {
    description: "Get user by ID"
  }

  func validateUser(user: User): ValidationResult {
    description: "Validate user data"
  }
}

// Cross-cutting concerns (aspects)
aspect Validation {
  description: "Validate all input parameters"
  before "component.*" {
    description: "Validate input data"
  }
}

aspect Logging {
  description: "Log method execution with timing"
  around "component.*" {
    description: "Log method calls with timing"
  }
}
```

### Supported Data Types
- `string`, `number`, `boolean`
- `datetime` (automatically converted to Date objects)
- `customType` (references other data entities)
- `Type?` (optional fields)

### Method Signatures
```typescript
func methodName(param1: Type1, param2: Type2): ReturnType
```

## Module-Specific Code Generation

### Frontend (TypeScript + React)
- **Data**: TypeScript interfaces/classes
- **Components**: React service classes with TypeScript types
- **Aspects**: Higher-order components or React hooks
- **Patterns**: Functional components, hooks, proper TypeScript typing

### Backend (Java + Spring)
- **Data**: JPA entity classes with database annotations
- **Components**: Spring @Service and @RestController classes
- **Aspects**: Spring AOP aspects for cross-cutting concerns
- **Patterns**: Dependency injection, REST APIs, proper package structure

### Shared (TypeScript + Node)
- **Data**: Common TypeScript interfaces/types
- **Components**: Shared utility classes and services
- **Aspects**: Node.js middleware or decorators
- **Patterns**: Module.exports, async/await, proper error handling

## Implementation Workflow

### When Contracts Change
1. **Detect Changes**: `/cdd build` analyzes contract hashes
2. **Generate Context**: Creates `build/implementation_context.json` with changed contracts
3. **Module-Specific Instructions**: Claude receives language/framework-specific guidance
4. **Generate Files**: Create implementations in correct `generated/` directories
5. **Update Hashes**: `/cdd hash` marks contracts as implemented

### File Organization
```
frontend/generated/
├── Todo.ts              # TypeScript interface for Todo data
├── TodoService.ts        # React service class
├── Validation.ts         # Validation aspect implementation
└── Logging.ts            # Logging aspect implementation

backend/generated/
├── Todo.java             # JPA entity class
├── TodoService.java       # Spring service
├── TodoController.java    # Spring REST controller
└── ValidationAspect.java  # Spring AOP aspect

shared/generated/
├── BaseEntity.ts         # Base types/interfaces
├── ValidationUtils.ts    # Shared validation logic
└── LoggingUtils.ts        # Shared logging utilities
```

## Key Development Patterns

### Contract-First Development
1. **Start with Contracts**: Define all requirements in CDD DSL first
2. **Generate Implementation**: Use `/cdd build` to get Claude's implementation
3. **Iterate**: Modify contracts and regenerate as needed

### Incremental Builds
- Only changed contracts generate new implementation instructions
- Hash-based tracking prevents unnecessary regeneration
- Existing implementations are preserved when contracts are unchanged

### Multi-Module Coordination
- Shared contracts are available to all dependent modules
- Each module generates code in its own language/framework
- Module dependencies are respected during code generation

## Troubleshooting

### Common Issues
1. **"Unknown slash command: cdd"**: Use `node .claude/commands/cdd_wrapper.js build` instead
2. **Hash file not found**: Run `/cdd hash` after implementing contracts
3. **Module not found**: Verify `project.cdd` configuration is correct
4. **Build directory errors**: Ensure `build/` directory exists or is created automatically

### Debug Commands
```bash
# Check which contracts are found
find . -name "*.cdd" -type f

# Test contract parsing
node .claude/commands/cdd_wrapper.js status

# Reset all hashes (testing only)
rm .cdd/hashes.csv
```

## Integration Notes

### Git Workflow
1. **Contract Definitions**: Commit `.cdd` files to track contract changes
2. **Generated Code**: Commit files in `*/generated/` directories
3. **Hash Tracking**: Commit `.cdd/hashes.csv` to track implementation state
4. **Build Artifacts**: Exclude `build/` directory (temporary files)

### Team Collaboration
- Contract changes trigger hash updates and regeneration
- Module boundaries are clearly defined in `project.cdd`
- Each team can work independently on their module's contracts

### Continuous Integration
- `/cdd build` can be integrated into CI/CD pipelines
- Contract changes automatically generate new implementation requirements
- Hash tracking ensures only changed contracts require attention