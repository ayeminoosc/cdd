const CDDUtils = require('./cdd_utils.js');
const cdd = new CDDUtils();

const command = process.argv[2];
const moduleTarget = process.argv[3]; // e.g., 'app.frontend'

if (command === 'build') {
  if (moduleTarget) {
      console.log(`🔨 Analyzing contracts for module: ${moduleTarget}...`);
    } else {
      console.log('🔨 Analyzing contracts for all modules...');
    }

    try {
      cdd.loadProjectConfig();
      const changes = cdd.getDiff(moduleTarget);

    console.log(`📊 Analysis complete:`);
    console.log(`  ➕ New contracts: ${changes.added.length}`);
    console.log(`  📝 Modified contracts: ${changes.modified.length}`);
    console.log(`  ✅ Unchanged contracts: ${changes.unchanged.length}`);

    if (changes.added.length === 0 && changes.modified.length === 0) {
      console.log('ℹ️  No contracts need implementation.');
    } else {
      console.log('\n📝 Preparing implementation instructions...');

      // Prepare context for implementation
      const context = cdd.getProjectContext();
      const contractsToImplement = [...changes.added, ...changes.modified];

      context.changedContracts = contractsToImplement.map(c => ({
        ...c,
        status: 'needs_implementation',
        changeType: changes.added.includes(c) ? 'new' : 'modified'
      }));

      context.allContracts = changes.all.map(c => {
        const parsed = cdd.parseContract(c.content);
        return {
          name: c.name,
          content: c.content,
          ...parsed,
          entities: parsed.data, // backward compatibility
          services: parsed.components // backward compatibility
        };
      });

      // Save context for Claude
      const fs = require('fs');
      const path = require('path');

      // Ensure build directory exists
      const buildDir = 'build';
      if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir, { recursive: true });
      }

      fs.writeFileSync(path.join(buildDir, 'implementation_context.json'), JSON.stringify(context, null, 2));

      console.log(`✅ Implementation context prepared for ${contractsToImplement.length} contract(s)`);
      console.log('📄 Context saved to: build/implementation_context.json');
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
} else if (command === 'hash') {
  console.log('🔐 Generating hashes for implemented contracts...');

  try {
    cdd.loadProjectConfig();
    const contracts = cdd.loadContracts();
    const contractsWithParsed = contracts.map(c => ({
      contract: c,
      parsed: cdd.parseContract(c.content)
    }));

    cdd.generateHashes(contractsWithParsed);
    console.log(`✅ Hashes generated for ${contracts.length} contract(s)`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
} else if (command === 'status') {
  console.log('📋 Contract Status Report');
  console.log('========================');

  try {
    cdd.loadProjectConfig();
    const changes = cdd.getDiff();

    console.log(`📁 Project: ${cdd.projectConfig.name || 'Unknown'}`);
    console.log(`🔧 Language: ${cdd.projectConfig.language}`);
    console.log(`📦 Framework: ${cdd.projectConfig.framework}`);
    console.log(`📄 Total contracts: ${changes.all.length}`);
    console.log(`➕ New: ${changes.added.length}`);
    console.log(`📝 Modified: ${changes.modified.length}`);
    console.log(`✅ Up to date: ${changes.unchanged.length}`);

    if (changes.added.length > 0) {
      console.log('\n🆕 New contracts:');
      changes.added.forEach(c => console.log(`  - ${c.contract.name}`));
    }

    if (changes.modified.length > 0) {
      console.log('\n📝 Modified contracts:');
      changes.modified.forEach(c => console.log(`  - ${c.contract.name}`));
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
} else {
  console.log('Usage: /cdd [build|hash|status]');
  console.log('  build  - Analyze contracts and prepare implementation');
  console.log('  hash   - Generate hashes for implemented contracts');
  console.log('  status - Show contract status report');
}