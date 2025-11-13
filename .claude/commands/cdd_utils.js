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
    let context = 'root'; // root, project, modules, dependencies, paths, plugins
    let currentModule = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('//')) {
        continue;
      }

      // Track context changes
      if (trimmed === 'project {') {
        context = 'project';
        continue;
      } else if (trimmed === 'modules {') {
        context = 'modules';
        continue;
      } else if (trimmed === 'dependencies {') {
        context = 'dependencies';
        continue;
      } else if (trimmed === 'paths {') {
        context = 'paths';
        continue;
      } else if (trimmed === 'plugins {') {
        context = 'plugins';
        continue;
      } else if (trimmed === '}') {
        // Exit current context
        if (currentModule) {
          currentModule = null; // Exit module
        } else if (context === 'modules' || context === 'dependencies' || context === 'paths' || context === 'plugins') {
          context = 'project'; // Exit section back to project
        } else if (context === 'project') {
          context = 'root'; // Exit project
        }
        continue;
      }

      // Parse based on context
      if (context === 'project') {
        // Parse top-level project properties
        if (trimmed.startsWith('name:')) {
          config.name = trimmed.split(':')[1].trim().replace(/"/g, '');
        } else if (trimmed.startsWith('version:')) {
          config.version = trimmed.split(':')[1].trim().replace(/"/g, '');
        } else if (trimmed.startsWith('language:')) {
          config.language = trimmed.split(':')[1].trim().replace(/"/g, '');
        } else if (trimmed.startsWith('framework:')) {
          config.framework = trimmed.split(':')[1].trim().replace(/"/g, '');
        }
      } else if (context === 'modules' && !currentModule) {
        // Parse module definitions (only when not inside a module)
        if (trimmed.includes(' {')) {
          const moduleName = trimmed.split(' {')[0].trim();
          currentModule = moduleName;
          config.modules[moduleName] = {};
        }
      } else if (currentModule) {
        // Parse module properties (when inside a module)
        if (trimmed.includes(':')) {
          const [key, value] = trimmed.split(':').map(s => s.trim());
          config.modules[currentModule][key] = value.replace(/"/g, '');
          // Debug output
          // console.log(`Set ${currentModule}.${key} = ${config.modules[currentModule][key]}`);
        }
      } else if (context === 'dependencies') {
        // Parse dependencies
        if (trimmed.includes(':')) {
          const [key, value] = trimmed.split(':').map(s => s.trim());
          const modules = value.replace(/[\[\]]/g, '').split(',').map(m => m.trim()).filter(m => m);
          config.dependencies[key] = modules;
        }
      } else if (context === 'paths') {
        // Parse paths
        if (trimmed.includes(':')) {
          const [key, value] = trimmed.split(':').map(s => s.trim());
          config.paths[key] = value.replace(/"/g, '');
        }
      } else if (context === 'plugins') {
        // Parse plugins
        if (trimmed.includes(':')) {
          const [key, value] = trimmed.split(':').map(s => s.trim());
          config.plugins[key] = value === 'true' ? true : value === 'false' ? false : value.replace(/"/g, '');
        }
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
    const findContracts = (dir, moduleName, baseDir) => {
      if (!fs.existsSync(dir)) {
        return;
      }

      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          // Recurse into subdirectories
          findContracts(itemPath, moduleName, baseDir);
        } else if (item.endsWith('.cdd')) {
          // Found a contract file
          // Calculate relative path from contracts directory to preserve package structure
          const relativePath = path.relative(baseDir, itemPath);

          contracts.push({
            name: item,
            package: moduleName,
            path: itemPath, // Keep the full absolute path
            relativePath: relativePath, // Add relative path for reference
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
        findContracts(moduleContractsDir, moduleName, moduleContractsDir);
      }
    }

    // Also scan global contracts directory if it exists
    if (this.projectConfig.paths && this.projectConfig.paths.contracts) {
      const globalContractsDir = path.join(this.projectRoot, this.projectConfig.paths.contracts);
      findContracts(globalContractsDir, 'default', globalContractsDir);
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
    let currentMethod = null;
    let pendingDoc = null;
    let inDocComment = false;
    const docLines = [];

    const finalizeDoc = () => {
      if (docLines.length === 0) {
        return null;
      }
      const doc = docLines
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
      docLines.length = 0;
      return doc || null;
    };

    const processCode = (code) => {
      if (code === null || code === undefined) {
        return;
      }

      const trimmed = code.trim();

      if (trimmed === '') {
        return;
      }

      if (trimmed.startsWith('//')) {
        currentMethod = null;
        return;
      }

      if (
        (trimmed.startsWith('component ') || trimmed.startsWith('service ')) &&
        trimmed.includes('{')
      ) {
        const match = trimmed.match(/^(?:component|service)\s+([A-Za-z0-9_]+)/);
        if (match) {
          currentSection = 'component';
          currentBlock = {
            name: match[1],
            type: 'component',
            description: pendingDoc || '',
            methods: []
          };
        } else {
          currentSection = null;
          currentBlock = null;
        }
        pendingDoc = null;
        currentMethod = null;
        return;
      }

      if (trimmed.startsWith('data ') && trimmed.includes('{')) {
        const match = trimmed.match(/^data\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_<>,.]+))?/);
        if (match) {
          currentSection = 'data';
          currentBlock = {
            name: match[1],
            extends: match[2] || null,
            type: 'data',
            description: pendingDoc || '',
            fields: []
          };
        } else {
          currentSection = null;
          currentBlock = null;
        }
        pendingDoc = null;
        currentMethod = null;
        return;
      }

      if (trimmed.startsWith('aspect ') && trimmed.includes('{')) {
        const match = trimmed.match(/^aspect\s+([A-Za-z0-9_]+)/);
        if (match) {
          currentSection = 'aspect';
          currentBlock = {
            name: match[1],
            type: 'aspect',
            description: pendingDoc || '',
            properties: {}
          };
        } else {
          currentSection = null;
          currentBlock = null;
        }
        pendingDoc = null;
        currentMethod = null;
        return;
      }

      if (trimmed === '{') {
        currentMethod = null;
        pendingDoc = null;
        return;
      }

      if (trimmed === '}') {
        if (currentBlock) {
          if (currentSection === 'data') {
            parsed.data.push(currentBlock);
          } else if (currentSection === 'component') {
            parsed.components.push(currentBlock);
          } else if (currentSection === 'aspect') {
            parsed.aspects.push(currentBlock);
          }
        }
        currentSection = null;
        currentBlock = null;
        currentMethod = null;
        pendingDoc = null;
        return;
      }

      if (!currentBlock) {
        pendingDoc = null;
        currentMethod = null;
        return;
      }

      if (currentMethod && trimmed.startsWith('description:')) {
        const descValue = trimmed.substring(13).trim().replace(/^['"]|['"]$/g, '');
        const combined = pendingDoc ? `${pendingDoc}\n${descValue}`.trim() : descValue;
        currentMethod.description = combined;
        currentMethod.hash = this.calculateHash(
          `${currentMethod.name}(${currentMethod.params.join(',')}):${currentMethod.returnType}:${currentMethod.description}`
        );
        pendingDoc = null;
        return;
      }

      if (trimmed.startsWith('description:')) {
        const descValue = trimmed.substring(13).trim().replace(/^['"]|['"]$/g, '');
        const combined = pendingDoc ? `${pendingDoc}\n${descValue}`.trim() : descValue;
        currentBlock.description = combined;
        pendingDoc = null;
        currentMethod = null;
        return;
      }

      if (currentSection === 'data' && trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
          const namePart = trimmed.slice(0, colonIndex).trim().replace(/[,;]/g, '');
          if (namePart && namePart !== 'description') {
            let typePart = trimmed.slice(colonIndex + 1).trim();
            if (typePart.endsWith(';')) {
              typePart = typePart.slice(0, -1).trim();
            }
            if (typePart) {
              const field = {
                name: namePart,
                type: typePart,
                description: pendingDoc || ''
              };
              field.hash = this.calculateHash(
                `${field.name}:${field.type}:${field.description}`
              );
              currentBlock.fields.push(field);
            }
          }
        }
        pendingDoc = null;
        currentMethod = null;
        return;
      }

      if (currentSection === 'component' && trimmed.startsWith('func ')) {
        const signature = trimmed.replace(/;\s*$/, '');
        let methodMatch = signature.match(
          /^func\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*:\s*([A-Za-z0-9_<>,.\[\]]+)$/
        );
        let method = null;

        if (methodMatch) {
          method = {
            name: methodMatch[1],
            params: methodMatch[2] ? methodMatch[2].split(',').map(p => p.trim()).filter(Boolean) : [],
            returnType: methodMatch[3].trim()
          };
        } else {
          methodMatch = signature.match(
            /^func\s+([A-Za-z0-9_<>,.\[\]]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)$/
          );
          if (methodMatch) {
            method = {
              name: methodMatch[2],
              params: methodMatch[3] ? methodMatch[3].split(',').map(p => p.trim()).filter(Boolean) : [],
              returnType: methodMatch[1].trim()
            };
          }
        }

        if (method) {
          const methodObj = {
            ...method,
            description: pendingDoc || ''
          };
          methodObj.hash = this.calculateHash(
            `${methodObj.name}(${methodObj.params.join(',')}):${methodObj.returnType}:${methodObj.description}`
          );
          currentBlock.methods.push(methodObj);
          currentMethod = methodObj;
        } else {
          currentMethod = null;
        }
        pendingDoc = null;
        return;
      }

      if (currentSection === 'aspect') {
        if (trimmed.includes(':')) {
          const [key, value] = trimmed.split(':').map(s => s.trim());
          if (key && value && key !== 'description') {
            currentBlock.properties[key] = value.replace(/"/g, '');
          }
        } else if (trimmed.match(/^(around|before|after|target)\s+/)) {
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            currentBlock.properties[parts[0]] = parts.slice(1).join(' ');
          }
        } else if (pendingDoc && !currentBlock.description) {
          currentBlock.description = pendingDoc;
        }
        pendingDoc = null;
        currentMethod = null;
        return;
      }

      pendingDoc = null;
      currentMethod = null;
    };

    for (const line of lines) {
      let remainder = line;

      while (remainder !== null) {
        if (inDocComment) {
          const endIndex = remainder.indexOf('*/');
          if (endIndex === -1) {
            docLines.push(remainder);
            remainder = null;
          } else {
            const beforeEnd = remainder.slice(0, endIndex);
            if (beforeEnd.length > 0) {
              docLines.push(beforeEnd);
            }
            const doc = finalizeDoc();
            if (doc) {
              pendingDoc = doc;
            }
            remainder = remainder.slice(endIndex + 2);
            inDocComment = false;
            if (remainder.trim() === '') {
              remainder = null;
            }
          }
          continue;
        }

        const startIndex = remainder.indexOf('/**');
        if (startIndex === -1) {
          if (remainder !== '') {
            processCode(remainder);
          }
          remainder = null;
        } else {
          const before = remainder.slice(0, startIndex);
          processCode(before);
          remainder = remainder.slice(startIndex + 3);
          inDocComment = true;
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
      if (data.description) {
        hashes.data[data.name].__description = this.calculateHash(`${data.name}:${data.description}`);
      }
      for (const field of data.fields) {
        hashes.data[data.name][field.name] = field.hash;
        if (field.description) {
          hashes.data[data.name][`${field.name}.__description`] = this.calculateHash(`${field.name}:${field.description}`);
        }
      }
    }

    // Extract component hashes
    for (const component of parsed.components) {
      hashes.components[component.name] = {};
      if (component.description) {
        hashes.components[component.name].__description = this.calculateHash(`${component.name}:${component.description}`);
      }
      for (const method of component.methods) {
        hashes.components[component.name][method.name] = method.hash;
        if (method.description) {
          hashes.components[component.name][`${method.name}.__description`] = this.calculateHash(`${method.name}:${method.description}`);
        }
      }
    }

    // Extract aspect hashes
    for (const aspect of parsed.aspects) {
      const descriptionPart = aspect.description ? `:${aspect.description}` : '';
      hashes.aspects[aspect.name] = {
        hash: this.calculateHash(`${aspect.name}:${JSON.stringify(aspect.properties)}${descriptionPart}`)
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
      hashes.lastUpdated = new Date().toISOString();
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
          if (fieldName === 'extends') {
            continue;
          }
          csv += `${dataName}.${fieldName},${data[fieldName]}\n`;
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