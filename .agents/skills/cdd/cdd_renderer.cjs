const fs = require('fs');
const path = require('path');

try {
  const buildDir = 'build';
  const contextPath = path.join(buildDir, 'implementation_context.json');

  if (!fs.existsSync(contextPath)) {
    console.log("");
    console.log("✅ All contracts are up to date!");
    console.log("=============================");
    console.log("");
    console.log("No implementation needed. All contracts are already implemented and their hashes match.");
    console.log("");
    console.log("If you've made changes to contracts, run '/cdd build' again to see what needs to be implemented.");
    console.log("");
    console.log("After implementing the contracts, run: /cdd hash");
    console.log("This will update the hashes and mark the contracts as implemented.");
    process.exit(0);
  }

  const context = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));

  console.log('# Contract Implementation Request');
  console.log('');
  console.log('## Project Context');
  console.log(`- **Project**: ${context.project.name}`);
  console.log(`- **Language**: ${context.project.language}`);
  console.log(`- **Output**: ${context.project.paths.output}`);
  console.log('');

  console.log('## Contracts to Implement');
  console.log('');

  context.changedContracts.forEach((c, i) => {
    console.log(`### ${i+1}. ${c.contract.name}`);
    console.log(`**Status**: ${c.status} (**${c.changeType}**)`);
    
    if (c.changeType === 'modified' && c.changedElements && c.changedElements.length > 0) {
      console.log('**⚠️ CHANGED ITEMS ONLY** - Implement/Update ONLY these items:');
      c.changedElements.forEach(item => console.log(`  - ${item}`));
    } else if (c.changeType === 'new') {
      console.log('**🆕 NEW CONTRACT** - Implement ALL items.');
    }
    
    console.log('');
    console.log('#### Contract Definition');
    console.log('```cdd');
    console.log(c.contract.content);
    console.log('```');
    console.log('');

    // Display detailed parsed structure
    if (c.parsed.data && c.parsed.data.length > 0) {
      console.log(`**Data Entities (${c.parsed.data.length})**:`);
      c.parsed.data.forEach(d => {
        console.log(`- **${d.name}**: ${d.fields.map(f => `${f.name}: ${f.type}`).join(', ')}`);
        if (d.extends) console.log(`  - Extends: ${d.extends}`);
      });
      console.log('');
    }

    // Display Screens
    if (c.parsed.screens && c.parsed.screens.length > 0) {
      console.log(`**Screens (${c.parsed.screens.length})**:`);
      c.parsed.screens.forEach(s => {
        console.log(`- **${s.name}**`);
        if (s.description) console.log(`  - Description: ${s.description}`);
        if (s.props.length) console.log(`  - Props: ${s.props.map(p => `${p.name}: ${p.type}`).join(', ')}`);
        if (s.state.length) console.log(`  - State: ${s.state.map(st => `${st.name}: ${st.type}`).join(', ')}`);
        if (s.methods.length) console.log(`  - Events: ${s.methods.map(m => m.name).join(', ')}`);
        if (s.connections.length) console.log(`  - Connections: ${s.connections.map(c => `${c.trigger} -> ${c.target}`).join(', ')}`);
      });
      console.log('');
    }

    // Display Widgets
    if (c.parsed.widgets && c.parsed.widgets.length > 0) {
      console.log(`**Widgets (${c.parsed.widgets.length})**:`);
      c.parsed.widgets.forEach(w => {
        console.log(`- **${w.name}**`);
        if (w.description) console.log(`  - Description: ${w.description}`);
        if (w.props.length) console.log(`  - Props: ${w.props.map(p => `${p.name}: ${p.type}`).join(', ')}`);
        if (w.state.length) console.log(`  - State: ${w.state.map(st => `${st.name}: ${st.type}`).join(', ')}`);
        if (w.methods.length) console.log(`  - Events: ${w.methods.map(m => m.name).join(', ')}`);
      });
      console.log('');
    }

    // Display Flows
    if (c.parsed.flows && c.parsed.flows.length > 0) {
      console.log(`**Flows (${c.parsed.flows.length})**:`);
      c.parsed.flows.forEach(f => {
        console.log(`- **${f.name}** (Start: ${f.start})`);
        if (f.description) console.log(`  - Description: ${f.description}`);
        if (f.routes.length) console.log(`  - Routes: ${f.routes.map(r => `${r.source} -> ${r.target}`).join(', ')}`);
      });
      console.log('');
    }

    // Display Services (Backwards Compat)
    const services = c.parsed.components.filter(comp => comp.type === 'component' || comp.type === 'service' || !comp.type);
    if (services.length > 0) {
      console.log(`**Services/Components (${services.length})**:`);
      services.forEach(comp => {
        let signature = `- **${comp.name}**`;
        if (comp.extends) signature += ` (Extends: ${comp.extends})`;
        signature += `: ${comp.methods.map(m => `${m.name}(${m.params.join(', ')}): ${m.returnType}`).join(', ')}`;
        console.log(signature);
        if (comp.description) console.log(`  - Description: ${comp.description}`);
      });
      console.log('');
    }
  });

  // Display module-specific implementation requirements from new organized structure
  if (context.modules) {
    Object.keys(context.modules).forEach(moduleKey => {
      const module = context.modules[moduleKey];
      
      // Check for Design System contract
      const designSystem = module.contracts.find(c => c.name.includes('DesignSystem') || c.name.includes('Theme'));
      
      if (module.contracts && module.contracts.length > 0) {
        console.log(`### Module: ${module.name} (${module.package})`);
        console.log(`**Language**: ${module.language}`);
        console.log(`**Output Directory**: ${module.output}/`);
        
        if (designSystem) {
          console.log('');
          console.log('🎨 **GLOBAL DESIGN SYSTEM DETECTED**');
          console.log(`Found styling contract: **${designSystem.name}**`);
          console.log('> **INSTRUCTION**: Use the description in this contract to configure the project\'s global theme.');
          console.log('> - For Web: Update `tailwind.config.js` or `index.css`.');
          console.log('> - For Mobile: Update `Theme.kt` or `Color.kt`.');
          console.log('> - Apply these visual rules (Colors, Typography, Spacing) to ALL generated Widgets and Screens.');
        }

        console.log('');

        // Display module-specific implementation instructions from JSON
        if (module.instructions) {
          console.log(module.instructions);
        } else {
          console.log(`⚠️  No implementation instructions found for module ${moduleKey}`);
        }

        console.log('');
        console.log(`**Implementation Plan for ${moduleKey}:**`);
        
        module.contracts.forEach(c => {
          // Frontend specific files
          if (c.parsed.screens && c.parsed.screens.length > 0) {
            console.log(`  - **Screens**: ${c.parsed.screens.map(s => `${module.output}/screens/${s.name}.${module.language === 'typescript' ? 'tsx' : 'kt'}`).join(', ')}`);
          }
          if (c.parsed.widgets && c.parsed.widgets.length > 0) {
            console.log(`  - **Components**: ${c.parsed.widgets.map(w => `${module.output}/components/${w.name}.${module.language === 'typescript' ? 'tsx' : 'kt'}`).join(', ')}`);
          }
          if (c.parsed.flows && c.parsed.flows.length > 0) {
            console.log(`  - **Navigation**: ${module.output}/navigation/AppRouter.${module.language === 'typescript' ? 'tsx' : 'kt'}`);
          }
          
          // Backend/Shared specific files
          const services = c.parsed.components.filter(comp => comp.type === 'component' || comp.type === 'service' || !comp.type);
          if (services.length > 0) {
            console.log(`  - **Services**: ${services.map(s => `${module.output}/${c.extractedPackage ? c.extractedPackage.replace(/\./g, '/') + '/' : ''}${s.name}.${module.language === 'java' ? 'java' : 'ts'}`).join(', ')}`);
          }
          if (c.parsed.data && c.parsed.data.length > 0) {
             console.log(`  - **Data Models**: ${c.parsed.data.map(d => `${module.output}/${c.extractedPackage ? c.extractedPackage.replace(/\./g, '/') + '/' : ''}${d.name}.${module.language === 'java' ? 'java' : 'ts'}`).join(', ')}`);
          }
        });
        console.log('');
        console.log('---');
      }
    });
  } else {
    console.log('⚠️  Module structure not available in context');
  }
  console.log('');
  console.log('## Implementation Guidelines');
  console.log('1. **Screens (`screen`)**: Implement as top-level pages. Use the `state` fields for local state management (useState/ViewModel). Connect lifecycle events (like `onMount`) to the backend calls defined in `connect`.');
  console.log('2. **Widgets (`widget`)**: Implement as reusable, pure components. They receive `props` and emit events via functions.');
  console.log('3. **Navigation (`flow`)**: Implement the routing logic. `route Source.Event -> Target` means when `Event` happens on `Source`, navigate to `Target`.');
  console.log('4. **Backend Wiring (`connect`)**: If a screen has `connect Event -> Service.Method`, generate the API client call automatically within that event handler.');
  console.log('5. **Visuals**: Use the `description` fields to determine layout, styling, and composition of widgets.');
  console.log('');
  console.log('After implementation, run: `/cdd hash` to update hashes.');

} catch (error) {
  console.error('Error:', error.message);
}
