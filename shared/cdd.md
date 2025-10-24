---
description: Shared module CDD implementation instructions
---

# Shared Module Implementation Instructions

## Module Configuration
- **Language**: TypeScript
- **Framework**: Node.js
- **Output Directory**: shared/generated/

## Implementation Requirements

### 1. Code Quality
- Write clean, idiomatic TypeScript code
- Follow Node.js best practices
- Include proper TypeScript types and annotations
- Use modern ES6+ syntax and patterns
- Include proper error handling and validation

### 2. Data Implementation
- Create TypeScript interfaces/classes for shared data models
- Include proper type definitions and field validations
- Add relationships and inheritance where applicable
- Ensure data models are framework-agnostic

### 3. Component Implementation
- Create Node.js services and utilities
- Use proper async/await patterns
- Include proper routing and error handling
- Implement all component methods with full business logic
- Include proper error handling and edge cases
- Add input validation and sanitization

### 4. Aspect Implementation
- Implement cross-cutting concerns (logging, caching, etc.)
- Ensure aspects are framework-agnostic for maximum reusability

### 5. File Naming
- Use .ts file extensions for all TypeScript files
- Follow Node.js naming conventions (camelCase for functions/services)
- Organize files in the shared/generated/ directory