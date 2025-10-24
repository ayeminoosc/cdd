const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CDDUtils {
  constructor() {
    this.projectRoot = process.cwd();
    this.projectConfig = null;
    this.hashFile = path.join(this.projectRoot, '.cdd', 'hashes.csv');
  }

  // Load project configuration from project.cdd
  loadProjectConfig() {
    const configPath = path.join(this.projectRoot, 'project.cdd');

    if (!fs.existsSync(configPath)) {
      throw new Error('project.cdd not found. Use CDD init to create a new project.');
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    this.projectConfig = this.parseConfig(configContent);
    return this.projectConfig;
  }

  // Parse project.cdd configuration
  parseConfig(content) {
    const config = {
      name: '',
      version: '1.0.0',
      language: 'typescript',
      framework: 'express',
      modules: {},
      dependencies: {},
      paths: {
        contracts: 'contracts',
        output: 'generated',
        source: 'src'
      },
      plugins: {
        validation: true,
        testing: true,
        documentation: true
      }
    };

    const lines = content.split('\n');
    let currentSection = null;
    let currentModule = null;
    let braceLevel = 0;
    let inProjectBlock = false;

    // Improved state machine parser with proper brace tracking
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('//')) {
        continue;
      }

      // Track brace level
      if (trimmed === '{') {
        braceLevel++;
        continue;
      } else if (trimmed === '}') {
        braceLevel--;
        if (braceLevel === 0) {
          inProjectBlock = false;
          currentSection = null;
          currentModule = null;
        }
        continue;
      }

      // Parse project block start
      if (trimmed.startsWith('project {')) {
        inProjectBlock = true;
        braceLevel = 1;
        continue;
      }

      // Parse top-level project properties (only when inside project block and at level 1)
      if (inProjectBlock && braceLevel === 1 && !currentSection && !currentModule) {
        if (trimmed.startsWith('name:')) {
          config.name = trimmed.split(':')[1].trim().replace(/"/g, '');
        } else if (trimmed.startsWith('version:')) {
          config.version = trimmed.split(':')[1].trim().replace(/"/g, '');
        } else if (trimmed.startsWith('language:')) {
          config.language = trimmed.split(':')[1].trim().replace(/"/g, '');
        } else if (trimmed.startsWith('framework:')) {
          config.framework = trimmed.split(':')[1].trim().replace(/"/g, '');
        }
        // Parse section starts (handle both "modules" and "modules {")
        else if (trimmed.startsWith('modules')) {
          currentSection = 'modules';
        } else if (trimmed.startsWith('dependencies')) {
          currentSection = 'dependencies';
        } else if (trimmed.startsWith('paths')) {
          currentSection = 'paths';
        } else if (trimmed.startsWith('plugins')) {
          currentSection = 'plugins';
        }
      }
      // Parse module definitions within modules section
      else if (currentSection === 'modules' && trimmed.includes(' {')) {
        const moduleName = trimmed.split(' {')[0].trim();
        currentModule = moduleName;
        config.modules[moduleName] = {};
      }
      // Parse module properties
      else if (currentModule && trimmed.includes(':')) {
        const [key, value] = trimmed.split(':').map(s => s.trim());
        config.modules[currentModule][key] = value.replace(/"/g, '');
      }
      // Parse dependencies
      else if (currentSection === 'dependencies' && trimmed.includes(':')) {
        const [key, value] = trimmed.split(':').map(s => s.trim());
        const modules = value.replace(/[\[\]]/g, '').split(',').map(m => m.trim()).filter(m => m);
        config.dependencies[key] = modules;
      }
      // Parse paths
      else if (currentSection === 'paths' && trimmed.includes(':')) {
        const [key, value] = trimmed.split(':').map(s => s.trim());
        config.paths[key] = value.replace(/"/g, '');
      }
      // Parse plugins
      else if (currentSection === 'plugins' && trimmed.includes(':')) {
        const [key, value] = trimmed.split(':').map(s => s.trim());
        config.plugins[key] = value === 'true' ? true : value === 'false' ? false : value.replace(/"/g, '');
      }
    }

    return config;
  }

  // Load all contract files (supports module structure)
  loadContracts() {
    if (!this.projectConfig) {
      this.loadProjectConfig();
    }

    const contracts = [];

    // Helper function to recursively find .cdd files
    const findContracts = (dir, moduleName) => {
      if (!fs.existsSync(dir)) {
        return;
      }

      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          // Recurse into subdirectories
          findContracts(itemPath, moduleName);
        } else if (item.endsWith('.cdd')) {
          // Found a contract file
          contracts.push({
            name: item,
            package: moduleName,
            path: itemPath,
            content: fs.readFileSync(itemPath, 'utf-8')
          });
        }
      }
    };

    // Scan each module's contracts directory
    if (this.projectConfig.modules) {
      for (const moduleName in this.projectConfig.modules) {
        const module = this.projectConfig.modules[moduleName];
        const moduleContractsDir = path.join(this.projectRoot, module.contracts);
        findContracts(moduleContractsDir, moduleName);
      }
    }

    // Also scan global contracts directory if it exists
    if (this.projectConfig.paths && this.projectConfig.paths.contracts) {
      const globalContractsDir = path.join(this.projectRoot, this.projectConfig.paths.contracts);
      findContracts(globalContractsDir, 'default');
    }

    return contracts;
  }

  // Parse contract content into structured format
  parseContract(content) {
    const parsed = {
      data: [],
      components: [],
      aspects: []
    };

    const lines = content.split('\n');
    let currentSection = null;
    let currentBlock = null;
    let inMethodBody = false;
    let currentMethod = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (trimmed.startsWith('//') || trimmed === '') {
        continue;
      }

      // Parse component (service)
      if (trimmed.startsWith('component ') && trimmed.includes('{')) {
        currentSection = 'component';
        const match = trimmed.match(/^component\s+(\w+)\s*\{?/);
        if (match) {
          currentBlock = {
            name: match[1],
            type: 'component',
            description: '',
            methods: []
          };
        }
      }
      // Parse data (entity)
      else if (trimmed.startsWith('data ') && trimmed.includes('{')) {
        currentSection = 'data';
        const match = trimmed.match(/^data\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{?/);
        if (match) {
          currentBlock = {
            name: match[1],
            extends: match[2] || null,
            type: 'data',
            description: '',
            fields: []
          };
        }
      }
      // Parse aspect
      else if (trimmed.startsWith('aspect ') && trimmed.includes('{')) {
        currentSection = 'aspect';
        const match = trimmed.match(/^aspect\s+(\w+)\s*\{?/);
        if (match) {
          currentBlock = {
            name: match[1],
            type: 'aspect',
            description: '',
            properties: {}
          };
        }
      }
      // End of block
      else if (trimmed === '}' && currentBlock) {
        if (inMethodBody && currentMethod) {
          currentBlock.methods.push(currentMethod);
          currentMethod = null;
          inMethodBody = false;
        } else {
          if (currentSection === 'data') {
            parsed.data.push(currentBlock);
          } else if (currentSection === 'component') {
            parsed.components.push(currentBlock);
          } else if (currentSection === 'aspect') {
            parsed.aspects.push(currentBlock);
          }
          currentBlock = null;
          currentSection = null;
        }
      }
      // Parse content inside blocks
      else if (currentBlock) {
        // Parse component description
        if (currentSection === 'component' && trimmed.startsWith('description:')) {
          currentBlock.description = trimmed.substring(13).trim().replace(/"/g, '');
        }
        // Parse data description
        else if (currentSection === 'data' && trimmed.startsWith('description:')) {
          currentBlock.description = trimmed.substring(13).trim().replace(/"/g, '');
        }
        // Parse aspect description
        else if (currentSection === 'aspect' && trimmed.startsWith('description:')) {
          currentBlock.description = trimmed.substring(13).trim().replace(/"/g, '');
        }
        // Parse data fields
        else if (currentSection === 'data' && trimmed.includes(':')) {
          const [name, type] = trimmed.split(':').map(s => s.trim());
          if (name && type && name !== 'description') {
            currentBlock.fields.push({
              name: name.replace(',', ''),
              type: type.trim(),
              hash: this.calculateHash(`${name}:${type}`)
            });
          }
        }
        // Parse component method signature
        else if (currentSection === 'component' && trimmed.match(/func\s+\w+\s*\([^)]*\)\s*:\s*\w+/)) {
          const match = trimmed.match(/func\s+(\w+)\s*\(([^)]*)\)\s*:\s*(\w+)/);
          if (match) {
            currentMethod = {
              name: match[1],
              params: match[2] ? match[2].split(',').map(p => p.trim()).filter(p => p) : [],
              returnType: match[3].trim(),
              description: '',
              hash: this.calculateHash(`${match[1]}(${match[2]}):${match[3]}`)
            };
            inMethodBody = true;
          }
        }
        // Parse method description inside method body
        else if (inMethodBody && currentMethod && trimmed.startsWith('description:')) {
          currentMethod.description = trimmed.substring(13).trim().replace(/"/g, '');
        }
        // Parse aspect properties (including around patterns)
        else if (currentSection === 'aspect') {
          if (trimmed.includes(':')) {
            const [key, value] = trimmed.split(':').map(s => s.trim());
            if (key && value && key !== 'description') {
              currentBlock.properties[key] = value.replace(/"/g, '');
            }
          } else if (trimmed.match(/^(around|before|after|target)\s+/)) {
            // Handle aspect patterns like "around com/aa/bb/*"
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
              currentBlock.properties[parts[0]] = parts.slice(1).join(' ');
            }
          }
        }
      }
    }

    return parsed;
  }

  // Calculate hash for content
  calculateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // Get changed contracts by comparing with stored hashes
  getDiff(moduleFilter = null) {
    const contracts = this.loadContracts();
    const storedHashes = this.loadHashes();
    const changes = {
      added: [],
      modified: [],
      unchanged: [],
      all: contracts
    };

    // Filter contracts by module if specified
    const filteredContracts = moduleFilter
      ? contracts.filter(c => c.package === moduleFilter || c.name.startsWith(`${moduleFilter}.`))
      : contracts;

    // Ensure build directory exists
    fs.mkdirSync(path.dirname(this.hashFile), { recursive: true });

    for (const contract of filteredContracts) {
      const parsed = this.parseContract(contract.content);
      const currentHashes = this.extractHashes(parsed, contract.name, contract.package);
      const contractKey = `${contract.package || 'default'}:${contract.name}`;

      if (!storedHashes[contractKey]) {
        // New contract
        changes.added.push({
          contract,
          parsed,
          hashes: currentHashes
        });
      } else {
        // Compare hashes
        const stored = storedHashes[contractKey];
        const isModified = this.compareHashes(stored, currentHashes);

        if (isModified) {
          changes.modified.push({
            contract,
            parsed,
            hashes: currentHashes,
            previousHashes: stored
          });
        } else {
          changes.unchanged.push({
            contract,
            parsed,
            hashes: currentHashes
          });
        }
      }
    }

    return changes;
  }

  // Extract all hashes from parsed contract
  extractHashes(parsed, contractName, packageKey = 'default') {
    const fullContractKey = `${packageKey}:${contractName}`;
    const hashes = {
      contract: fullContractKey,
      data: {},
      components: {},
      aspects: {},
      lastUpdated: new Date().toISOString()
    };

    // Extract data hashes
    for (const data of parsed.data) {
      hashes.data[data.name] = {};
      if (data.extends) {
        hashes.data[data.name].extends = data.extends;
      }
      for (const field of data.fields) {
        hashes.data[data.name][field.name] = field.hash;
      }
    }

    // Extract component hashes
    for (const component of parsed.components) {
      hashes.components[component.name] = {};
      for (const method of component.methods) {
        hashes.components[component.name][method.name] = method.hash;
      }
    }

    // Extract aspect hashes
    for (const aspect of parsed.aspects) {
      hashes.aspects[aspect.name] = {
        hash: this.calculateHash(`${aspect.name}:${JSON.stringify(aspect.properties)}`)
      };
    }

    return hashes;
  }

  // Load stored hashes from CSV file
  loadHashes() {
    if (!fs.existsSync(this.hashFile)) {
      return {};
    }

    const content = fs.readFileSync(this.hashFile, 'utf-8');
    const hashes = {};

    const lines = content.split('\n');
    let currentContract = null;
    let currentSection = null;

    for (const line of lines) {
      if (line.startsWith('contract:')) {
        const parts = line.split(':');
        currentContract = parts.slice(1).join(':'); // Join all parts after the first colon
        currentSection = null;
        hashes[currentContract] = {
          contract: currentContract,
          data: {},
          components: {},
          aspects: {},
          lastUpdated: null
        };
      } else if (line.startsWith('section:')) {
        currentSection = line.split(':')[1];
      } else if (line.includes(',') && currentContract && currentSection) {
        const [key, hash] = line.split(',');
        if (currentSection === 'data' || currentSection === 'components') {
          const [item, field] = key.split('.');
          if (!hashes[currentContract][currentSection][item]) {
            hashes[currentContract][currentSection][item] = {};
          }
          hashes[currentContract][currentSection][item][field] = hash;
        } else if (currentSection === 'aspects') {
          if (!hashes[currentContract][currentSection]) {
            hashes[currentContract][currentSection] = {};
          }
          hashes[currentContract][currentSection][key] = { hash };
        }
      } else if (line.startsWith('updated:')) {
        if (currentContract) {
          hashes[currentContract].lastUpdated = line.split(':')[1];
        }
      }
    }

    return hashes;
  }

  // Compare current hashes with stored hashes
  compareHashes(stored, current) {
    // Create copies without lastUpdated for comparison
    const storedCopy = { ...stored };
    const currentCopy = { ...current };
    delete storedCopy.lastUpdated;
    delete currentCopy.lastUpdated;

    // Compare hash values only, ignoring timestamps
    return JSON.stringify(storedCopy) !== JSON.stringify(currentCopy);
  }

  // Generate and save hashes for contracts after implementation
  generateHashes(contracts) {
    const allHashes = this.loadHashes();

    for (const contractData of contracts) {
      const { contract, parsed } = contractData;
      const hashes = this.extractHashes(parsed, contract.name, contract.package);
      const contractKey = `${contract.package || 'default'}:${contract.name}`;
      allHashes[contractKey] = hashes;
    }

    this.saveHashes(allHashes);
    return allHashes;
  }

  // Save hashes to CSV file
  saveHashes(hashes) {
    fs.mkdirSync(path.dirname(this.hashFile), { recursive: true });

    let csv = '';

    for (const contractName in hashes) {
      const contractHash = hashes[contractName];
      csv += `contract:${contractName}\n`;
      csv += `updated:${contractHash.lastUpdated}\n`;

      // Write data
      for (const dataName in contractHash.data) {
        csv += `section:data\n`;
        const data = contractHash.data[dataName];
        for (const fieldName in data) {
          if (fieldName !== 'extends') { // Skip the extends field as it's not a hashable field
            csv += `${dataName}.${fieldName},${data[fieldName]}\n`;
          }
        }
      }

      // Write components
      for (const componentName in contractHash.components) {
        csv += `section:components\n`;
        const component = contractHash.components[componentName];
        for (const methodName in component) {
          csv += `${componentName}.${methodName},${component[methodName]}\n`;
        }
      }

      // Write aspects
      for (const aspectName in contractHash.aspects) {
        csv += `section:aspects\n`;
        csv += `${aspectName},${contractHash.aspects[aspectName].hash}\n`;
      }

      csv += '\n';
    }

    fs.writeFileSync(this.hashFile, csv);
  }

  // Read prompt template file
  readPromptTemplate(templateName) {
    const templatePath = path.join(this.projectRoot, '.claude', 'prompts', `${templateName}.md`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Prompt template not found: ${templatePath}`);
    }

    return fs.readFileSync(templatePath, 'utf-8');
  }

  // Get project context for prompts
  getProjectContext() {
    if (!this.projectConfig) {
      this.loadProjectConfig();
    }

    return {
      project: this.projectConfig,
      projectRoot: this.projectRoot,
      contracts: this.loadContracts(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = CDDUtils;