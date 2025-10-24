const CDDUtils = require('./cdd_utils.js');
const cdd = new CDDUtils();

const command = process.argv[2];
const moduleTarget = process.argv[3]; // e.g., 'app.frontend'

if (command === 'clean') {
  console.log('🧹 Cleaning build artifacts...');

  const fs = require('fs');
  const path = require('path');

  // Clean build directory
  const buildDir = 'build';
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
    console.log(`✅ Removed ${buildDir}/ directory`);
  }

  // Clean generated directories for all modules
  const cdd = new CDDUtils();
  cdd.loadProjectConfig();

  if (cdd.projectConfig.modules) {
    for (const [moduleKey, moduleConfig] of Object.entries(cdd.projectConfig.modules)) {
      const generatedDir = moduleConfig.output;
      if (fs.existsSync(generatedDir)) {
        fs.rmSync(generatedDir, { recursive: true, force: true });
        console.log(`✅ Removed ${generatedDir}/ directory`);
      }
    }
  }

  // Clean global generated directory if it exists
  if (cdd.projectConfig.paths && cdd.projectConfig.paths.output) {
    const globalGeneratedDir = cdd.projectConfig.paths.output;
    if (fs.existsSync(globalGeneratedDir)) {
      fs.rmSync(globalGeneratedDir, { recursive: true, force: true });
      console.log(`✅ Removed ${globalGeneratedDir}/ directory`);
    }
  }

  console.log('🎉 Clean completed!');

} else if (command === 'clean-build') {
  console.log('🧹 Cleaning and then building...');

  // First clean (reuse clean logic)
  const fs = require('fs');
  const path = require('path');

  // Clean build directory
  const buildDir = 'build';
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }

  // Clean generated directories
  cdd.loadProjectConfig();

  if (cdd.projectConfig.modules) {
    for (const [moduleKey, moduleConfig] of Object.entries(cdd.projectConfig.modules)) {
      const generatedDir = moduleConfig.output;
      if (fs.existsSync(generatedDir)) {
        fs.rmSync(generatedDir, { recursive: true, force: true });
      }
    }
  }

  // Clean global generated directory if it exists
  if (cdd.projectConfig.paths && cdd.projectConfig.paths.output) {
    const globalGeneratedDir = cdd.projectConfig.paths.output;
    if (fs.existsSync(globalGeneratedDir)) {
      fs.rmSync(globalGeneratedDir, { recursive: true, force: true });
    }
  }

  console.log('✅ Clean completed, starting build...');

  // Remove hashes to force rebuild
  const hashFile = path.join(cdd.projectRoot, '.cdd', 'hashes.csv');
  if (fs.existsSync(hashFile)) {
    fs.unlinkSync(hashFile);
  }

  // Then continue with normal build logic
  if (moduleTarget) {
      console.log(`🔨 Analyzing contracts for module: ${moduleTarget}...`);
    } else {
      console.log('🔨 Analyzing contracts for all modules...');
    }

} else if (command === 'build') {
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

      // Group contracts by module and include module instructions
      const modules = {};
      const fs = require('fs');
      const path = require('path');

      // Initialize modules from project config
      for (const [moduleKey, moduleConfig] of Object.entries(context.project.modules || {})) {
        // Read module-specific cdd.md instructions
        let moduleInstructions = '';
        const moduleCddPath = path.join(process.cwd(), moduleKey, 'cdd.md');
        if (fs.existsSync(moduleCddPath)) {
          moduleInstructions = fs.readFileSync(moduleCddPath, 'utf-8');
          // Extract content after frontmatter
          const contentMatch = moduleInstructions.match(/---[\s\S]*?---([\s\S]*)/);
          if (contentMatch) {
            moduleInstructions = contentMatch[1].trim();
          }
        }

        modules[moduleKey] = {
          name: moduleConfig.name || moduleKey,
          package: moduleKey,
          language: moduleConfig.language,
          output: moduleConfig.output,
          instructions: moduleInstructions,
          contracts: []
        };
      }

      // Add contracts to their respective modules
      contractsToImplement.forEach(c => {
        const moduleKey = c.contract.package;
        if (modules[moduleKey]) {
          const parsed = cdd.parseContract(c.contract.content);

          // Extract package from relative path
          let extractedPackage = null;
          if (c.contract.relativePath) {
            const pathParts = c.contract.relativePath.split(path.sep);
            // Remove the contract filename from path
            const dirParts = pathParts.slice(0, -1);
            if (dirParts.length > 0) {
              extractedPackage = dirParts.join('.');
            }
          }

          modules[moduleKey].contracts.push({
            name: c.contract.name,
            content: c.contract.content,
            path: c.contract.path,
            relativePath: c.contract.relativePath,
            extractedPackage: extractedPackage, // Add extracted package info
            parsed: parsed,
            status: 'needs_implementation',
            changeType: changes.added.includes(c) ? 'new' : 'modified'
          });
        }
      });

      // Update context with organized module structure
      context.modules = modules;

      // Remove duplicate contracts array - use module organization instead
      delete context.contracts;

      // Keep changedContracts for backward compatibility but only include metadata
      context.changedContracts = contractsToImplement.map(c => ({
        contract: {
          name: c.contract.name,
          package: c.contract.package,
          path: c.contract.path,
          relativePath: c.contract.relativePath
        },
        status: 'needs_implementation',
        changeType: changes.added.includes(c) ? 'new' : 'modified'
      }));

      // Keep allContracts for backward compatibility but only include metadata
      context.allContracts = changes.all.map(c => {
        const parsed = cdd.parseContract(c.content);
        return {
          name: c.name,
          package: c.package,
          ...parsed,
          entities: parsed.data, // backward compatibility
          services: parsed.components // backward compatibility
        };
      });

      // Save context for Claude

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
  console.log('Usage: /cdd [build|hash|status|clean|clean-build]');
  console.log('  build       - Analyze contracts and prepare implementation');
  console.log('  hash        - Generate hashes for implemented contracts');
  console.log('  status      - Show contract status report');
  console.log('  clean       - Clean build and generated directories');
  console.log('  clean-build - Clean and then rebuild all contracts');
}