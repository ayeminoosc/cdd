# Contract Implementation Request

## Project Context
- **Project Name**: {{project.name}}
- **Language**: {{project.language}}
- **Framework**: {{project.framework}}
- **Output Directory**: {{project.paths.output}}
- **Timestamp**: {{timestamp}}

## Contracts to Implement

{{#each changedContracts}}
### {{contract.name}}

**Status**: {{status}}
**Change Type**: {{changeType}}

#### Contract Definition
```cdd
{{contract.content}}
```

#### Parsed Components
{{#if parsed.entities}}
**Entities ({{parsed.entities.length}})**:
{{#each parsed.entities}}
- **{{name}}**: {{#each fields}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}
{{/each}}

{{/if}}
{{#if parsed.services}}
**Services ({{parsed.services.length}})**:
{{#each parsed.services}}
- **{{name}}**: {{#each methods}}{{name}}({{#each params}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}): {{returnType}}{{#unless @last}}, {{/unless}}{{/each}}
{{/each}}

{{/if}}
{{#if parsed.aspects}}
**Aspects ({{parsed.aspects.length}})**:
{{#each parsed.aspects}}
- **{{name}}
{{/each}}
{{/if}}
{{/each}}

## Implementation Requirements

**IMPORTANT**: You must directly implement these contracts by creating the actual code files. Do not provide implementation plans or discuss what you will do - create the files immediately.

### 1. Code Quality
- Write clean, maintainable, and idiomatic {{project.language}} code
- Follow {{project.framework}} best practices and patterns
- Include proper error handling and validation
- Add comprehensive JSDoc/TypeScript annotations

### 2. Entity Implementation
- Create TypeScript interfaces/classes for all entities
- Include proper type definitions and field validations
- Add relationships between entities if applicable
- Consider data validation and transformation

### 3. Service Implementation
- Implement all service methods with full business logic
- Include proper error handling and edge cases
- Add input validation and sanitization
- Use appropriate data structures and algorithms
- Include logging and monitoring hooks

### 4. Aspect Implementation
- Implement cross-cutting concerns (logging, caching, validation, etc.)
- Use appropriate patterns for the target framework
- Ensure aspects are properly integrated with services

### 5. Additional Requirements
- Write unit tests for all major functionality
- Include example usage and documentation
- Consider performance and security implications
- Follow SOLID principles and clean architecture

## File Structure
Create files in the following structure:
- `{{project.paths.output}}/` - All generated code
- Entities: `{{project.paths.output}}/{EntityName}.ts`
- Services: `{{project.paths.output}}/{ServiceName}.ts`
- Aspects: `{{project.paths.output}}/{AspectName}.aspect.ts`

## Related Context
{{#if allContracts}}
The following other contracts exist in this project:
{{#each allContracts}}
- {{name}} ({{entities.length}} entities, {{services.length}} services, {{aspects.length}} aspects)
{{/each}}
{{/if}}

## Final Instruction
Create all the implementation files now. Start with entities, then services, then aspects. Ensure all files are created in the correct directory structure with complete, working implementations.

After implementation, run the hash generation to mark these contracts as implemented.