---
description: Backend module CDD implementation instructions
---

# Backend Module Implementation Instructions

## Module Configuration
- **Language**: Java
- **Framework**: Spring Boot
- **Output Directory**: backend/generated/

## Implementation Requirements

### 1. Code Quality
- **CRITICAL**: Create JAVA files, not TypeScript files
- Write clean, idiomatic Java code
- Follow Spring Boot best practices
- Follow Java naming conventions (PascalCase classes, camelCase methods)
- Use JPA annotations (@Entity, @Table, @Column)
- Add proper Java type safety and validation
- Include proper error handling and validation

### 2. Package Structure Requirements
- **CRITICAL**: Match the contract's package structure in generated code
- Extract package from contract path: `contracts/com/acf/testing/Contract.cdd` → package `com.acf.testing`
- Create generated files under: `generated/com/acf/testing/`
- Entity classes: `generated/com/acf/testing/EntityName.java`
- Service classes: `generated/com/acf/testing/ServiceName.java`
- Aspect classes: `generated/com/acf/testing/AspectName.java`
- **Every Java file must have correct package declaration**: `package com.acf.testing;`
- **NO additional subdirectories** - files go directly in the package folder

### 3. Data Implementation
- Create Java entity classes with proper package declarations
- Include JPA annotations for database mapping
- Add proper field validations and constraints
- Implement relationships and inheritance where applicable
- Place entities directly in `generated/{package}/` directory

### 4. Component Implementation
- Create Spring Boot services and controllers with correct package declarations
- Use Spring annotations (@Service, @RestController, etc.)
- Include proper dependency injection and REST API patterns
- Implement all component methods with full business logic
- Include proper error handling and edge cases
- Add input validation and sanitization
- Place services directly in `generated/{package}/` directory

### 5. Aspect Implementation
- Implement cross-cutting concerns (logging, caching, etc.) with correct package declarations
- Use Spring AOP patterns for aspect implementation
- Ensure aspects are properly integrated
- Place aspects directly in `generated/{package}/` directory

### 6. File Naming and Structure
- Use .java file extensions for all Java files
- **Package mapping**: Extract from contract relative path
  - `contracts/com/acf/testing/Contract.cdd` → `package com.acf.testing`
  - `contracts/com/company/project/Contract.cdd` → `package com.company.project`
- **Directory structure**: `generated/{extracted-package}/ClassName.java` (NO subdirectories)
- **Java class declaration**: Must match directory package exactly