---
description: Contract-Driven Development (CDD) workflow commands
---

Execute CDD commands and orchestrate contract implementation workflow.

## Pseudo Contract Grammar

CDD now supports two descriptive styles inside `.cdd` contracts:

1. **Inline directives** using `description:` keys (legacy)
2. **Doc comment blocks** using the familiar multi-line format:

```
/**
 * High level description...
 */
service Agent {
  /**
   * Method description...
   */
  func AgentResponse react(string request, WorkingMemory memory, AgentConfig config);
}
```

Doc comments are attached to the next declaration (service, data, aspect, field, or method) and included in the implementation context and hashing flow. This allows contracts written in the `engine.cdd` style to produce stable hashes as long as the relevant descriptions remain unchanged.

## Available Commands
- `build` - Analyze contracts and prepare implementation instructions
- `hash` - Generate hashes for implemented contracts
- `status` - Show contract status report

```bash
# Execute CDD command
node .claude/commands/cdd_wrapper.js $ARGUMENTS

# If build command created implementation context, present it to Claude
if [ "$1" = "build" ]; then
  if [ -f "build/implementation_context.json" ]; then
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

    // Display module-specific implementation requirements from new organized structure
    if (context.modules) {
      Object.keys(context.modules).forEach(moduleKey => {
        const module = context.modules[moduleKey];
        if (module.contracts && module.contracts.length > 0) {
          console.log(\`### Module: \${module.name} (\${module.package})\`);
          console.log(\`**Language**: \${module.language}\`);
          console.log(\`**Output Directory**: \${module.output}/\`);
          console.log('');

          // Display module-specific implementation instructions from JSON
          if (module.instructions) {
            console.log(module.instructions);
          } else {
            console.log(\`⚠️  No implementation instructions found for module \${moduleKey}\`);
          }

          console.log('');
          console.log(\`**Contracts to implement for \${moduleKey}:\`);

          module.contracts.forEach(c => {
            console.log(\`- **\${c.name}** (\${c.changeType})\`);
            if (c.parsed.data && c.parsed.data.length > 0) {
              console.log(\`  - Data: \${c.parsed.data.map(d => d.name).join(', ')}\`);
            }
            if (c.parsed.components && c.parsed.components.length > 0) {
              console.log(\`  - Components: \${c.parsed.components.map(comp => comp.name).join(', ')}\`);
            }
            if (c.parsed.aspects && c.parsed.aspects.length > 0) {
              console.log(\`  - Aspects: \${c.parsed.aspects.map(a => a.name).join(', ')}\`);
            }
          });

          console.log('');
          console.log(\`**Files to implement for \${moduleKey}:\`);
          module.contracts.forEach(c => {
            if (c.parsed.data && c.parsed.data.length > 0) {
              console.log(\`- Data: \${c.parsed.data.map(d => \`\${module.output}/\${d.name}.\${module.language === 'java' ? 'java' : 'ts'}\`).join(', ')}\`);
            }
            if (c.parsed.components && c.parsed.components.length > 0) {
              console.log(\`- Components: \${c.parsed.components.map(comp => \`\${module.output}/\${comp.name}.\${module.language === 'java' ? 'java' : 'ts'}\`).join(', ')}\`);
            }
            if (c.parsed.aspects && c.parsed.aspects.length > 0) {
              console.log(\`- Aspects: \${c.parsed.aspects.map(a => \`\${module.output}/\${a.name}.\${module.language === 'java' ? 'java' : 'ts'}\`).join(', ')}\`);
            }
          });
          console.log('');
          console.log('---');
        }
      });
    } else {
      // Fallback to old structure if modules not available
      console.log('⚠️  Module structure not available in context');
    }
    console.log('');
    console.log('## Final Instruction');
    console.log('Implement each module following its specific instructions above.');
    console.log('After implementation, run: `/cdd hash` to update hashes.');

  } catch (error) {
    console.error('Error:', error.message);
  }
  "

  else
    echo ""
    echo "✅ All contracts are up to date!"
    echo "============================="
    echo ""
    echo "No implementation needed. All contracts are already implemented and their hashes match."
    echo ""
    echo "If you've made changes to contracts, run '/cdd build' again to see what needs to be implemented."
  fi

  echo ""
  echo "After implementing the contracts, run: /cdd hash"
  echo "This will update the hashes and mark the contracts as implemented."
fi
```