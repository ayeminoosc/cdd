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
- Include proper Java package structure (com.example.entity, etc.)
- Follow Java naming conventions (PascalCase classes, camelCase methods)
- Use JPA annotations (@Entity, @Table, @Column)
- Add proper Java type safety and validation
- Include proper error handling and validation

### 2. Data Implementation
- Create Java entity classes with proper annotations
- Include JPA annotations for database mapping
- Add proper field validations and constraints
- Implement relationships and inheritance where applicable

### 3. Component Implementation
- Create Spring Boot services and controllers
- Use Spring annotations (@Service, @RestController, etc.)
- Include proper dependency injection and REST API patterns
- Implement all component methods with full business logic
- Include proper error handling and edge cases
- Add input validation and sanitization

### 4. Aspect Implementation
- Implement cross-cutting concerns (logging, caching, etc.)
- Use Spring AOP patterns for aspect implementation
- Ensure aspects are properly integrated

### 5. File Naming
- Use .java file extensions for all Java files
- Follow Java package structure (com.example.*)
- Organize files in the backend/generated/ directory with proper package folders