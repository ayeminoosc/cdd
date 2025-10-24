---
description: Contract-Driven Development (CDD) workflow commands
---

Execute CDD commands and orchestrate contract implementation workflow.

## Available Commands
- `build` - Analyze contracts and prepare implementation instructions
- `hash` - Generate hashes for implemented contracts
- `status` - Show contract status report

```bash
# Execute CDD command
node .claude/commands/cdd_wrapper.js $ARGUMENTS

# If build command created implementation context, present it to Claude
if [ "$1" = "build" ] && [ -f "build/implementation_context.json" ]; then
  echo ""
  echo "🤖 Implementation Instructions for Claude:"
  echo "=========================================="

  # Present implementation context to Claude
  node -e "
  const CDDUtils = require('./.claude/commands/cdd_utils.js');
  const cdd = new CDDUtils();
  const fs = require('fs');

  try {
    const context = JSON.parse(fs.readFileSync('build/implementation_context.json', 'utf-8'));

    console.log('# Contract Implementation Request');
    console.log('');
    console.log('## Project Context');
    console.log(\`- **Project**: \${context.project.name}\`);
    console.log(\`- **Language**: \${context.project.language}\`);
    console.log(\`- **Framework**: \${context.project.framework}\`);
    console.log(\`- **Output**: \${context.project.paths.output}\`);
    console.log('');

    console.log('## Contracts to Implement');
    console.log('');

    context.changedContracts.forEach((c, i) => {
      console.log(\`### \${i+1}. \${c.contract.name}\`);
      console.log(\`**Status**: \${c.status} (**\${c.changeType}**)\`);
      console.log('');
      console.log('#### Contract Definition');
      console.log('```cdd');
      console.log(c.contract.content);
      console.log('```');
      console.log('');

      if (c.parsed.data && c.parsed.data.length > 0) {
        console.log(\`**Data (\${c.parsed.data.length})**:\`);
        c.parsed.data.forEach(d => {
          console.log(\`- **\${d.name}**: \${d.fields.map(f => \`\${f.name}: \${f.type}\`).join(', ')}\`);
          if (d.extends) console.log(\`  - Extends: \${d.extends}\`);
        });
        console.log('');
      }

      if (c.parsed.components && c.parsed.components.length > 0) {
        console.log(\`**Components (\${c.parsed.components.length})**:\`);
        c.parsed.components.forEach(comp => {
          console.log(\`- **\${comp.name}**: \${comp.methods.map(m => \`\${m.name}(\${m.params.join(', ')}): \${m.returnType}\`).join(', ')}\`);
          if (comp.description) console.log(\`  - Description: \${comp.description}\`);
        });
        console.log('');
      }

      if (c.parsed.aspects && c.parsed.aspects.length > 0) {
        console.log(\`**Aspects (\${c.parsed.aspects.length})**:\`);
        c.parsed.aspects.forEach(a => {
          console.log(\`- **\${a.name}**\${a.description ? \` - \${a.description}\` : ''}\`);
        });
        console.log('');
      }
    });

    console.log('## Implementation Requirements');
    console.log('');
    console.log('**IMPORTANT**: Create the actual implementation files immediately. Do not provide plans or discussions.');
    console.log('');
    console.log('### 1. Code Quality');
    console.log(\`- Write clean, idiomatic \${context.project.language} code\`);
    console.log(\`- Follow \${context.project.framework} best practices\`);
    console.log('- Include proper error handling and validation');
    console.log('- Add comprehensive TypeScript annotations');
    console.log('');
    console.log('### 2. Data Implementation');
    console.log('- Create TypeScript interfaces/classes for all data');
    console.log('- Include proper type definitions and field validations');
    console.log('- Add relationships and inheritance where applicable');
    console.log('');
    console.log('### 3. Component Implementation');
    console.log('- Implement all component methods with full business logic');
    console.log('- Include proper error handling and edge cases');
    console.log('- Add input validation and sanitization');
    console.log('');
    console.log('### 4. Aspect Implementation');
    console.log('- Implement cross-cutting concerns (logging, caching, etc.)');
    console.log('- Ensure aspects are properly integrated');
    console.log('');
    console.log('## File Structure');

    // Group contracts by module and show module-specific output paths
    const contractsByModule = {};
    context.changedContracts.forEach(c => {
      const moduleKey = c.contract.package;
      if (!contractsByModule[moduleKey]) {
        contractsByModule[moduleKey] = [];
      }
      contractsByModule[moduleKey].push(c);
    });

    Object.keys(contractsByModule).forEach(moduleKey => {
      const moduleConfig = context.project.modules[moduleKey];
      if (moduleConfig) {
        console.log(\`### Module: \${moduleConfig.name} (\${moduleKey})\`);
        console.log(\`**Output Directory**: \${moduleConfig.output}/\`);
        console.log('');

        contractsByModule[moduleKey].forEach(c => {
          console.log(\`**Contracts for \${c.contract.name}:**\`);

          if (c.parsed.data && c.parsed.data.length > 0) {
            console.log(\`- Data: \${c.parsed.data.map(d => \`\${moduleConfig.output}/\${d.name}.ts\`).join(', ')}\`);
          }

          if (c.parsed.components && c.parsed.components.length > 0) {
            console.log(\`- Components: \${c.parsed.components.map(comp => \`\${moduleConfig.output}/\${comp.name}.ts\`).join(', ')}\`);
          }

          if (c.parsed.aspects && c.parsed.aspects.length > 0) {
            console.log(\`- Aspects: \${c.parsed.aspects.map(a => \`\${moduleConfig.output}/\${a.name}.aspect.ts\`).join(', ')}\`);
          }
          console.log('');
        });
      }
    });
    console.log('');
    console.log('## Final Instruction');
    console.log('Create all implementation files now. Start with data, then components, then aspects.');
    console.log('After implementation, run: `/cdd hash` to update hashes.');

  } catch (error) {
    console.error('Error:', error.message);
  }
  "

  echo ""
  echo "After implementing the contracts, run: /cdd hash"
  echo "This will update the hashes and mark the contracts as implemented."
fi
```