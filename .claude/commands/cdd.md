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

    // Group contracts by module and show module-specific implementation requirements
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
        console.log(\`**Language**: \${moduleConfig.language}\`);
        console.log(\`**Output Directory**: \${moduleConfig.output}/\`);
        console.log('');

        // Read and display module-specific implementation instructions
        const moduleCddPath = \`\${moduleKey}/cdd.md\`;
        if (fs.existsSync(moduleCddPath)) {
          const moduleInstructions = fs.readFileSync(moduleCddPath, 'utf-8');
          // Extract content between --- markers and after
          const contentMatch = moduleInstructions.match(/---[\\s\\S]*?---([\\s\\S]*)/);
          if (contentMatch) {
            console.log(contentMatch[1].trim());
          } else {
            console.log(moduleInstructions);
          }
        } else {
          console.log(\`⚠️  Module-specific instructions not found at \${moduleCddPath}\`);
        }

        console.log('');
        console.log(\`**Files to implement for \${moduleKey}:\`);
        contractsByModule[moduleKey].forEach(c => {
          if (c.parsed.data && c.parsed.data.length > 0) {
            console.log(\`- Data: \${c.parsed.data.map(d => \`\${moduleConfig.output}/\${d.name}.\${moduleConfig.language === 'java' ? 'java' : 'ts'}\`).join(', ')}\`);
          }
          if (c.parsed.components && c.parsed.components.length > 0) {
            console.log(\`- Components: \${c.parsed.components.map(comp => \`\${moduleConfig.output}/\${comp.name}.\${moduleConfig.language === 'java' ? 'java' : 'ts'}\`).join(', ')}\`);
          }
          if (c.parsed.aspects && c.parsed.aspects.length > 0) {
            console.log(\`- Aspects: \${c.parsed.aspects.map(a => \`\${moduleConfig.output}/\${a.name}.\${moduleConfig.language === 'java' ? 'java' : 'ts'}\`).join(', ')}\`);
          }
        });
        console.log('');
        console.log('---');
      }
    });
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