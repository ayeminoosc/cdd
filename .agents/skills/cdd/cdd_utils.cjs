const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CDDUtils {
  constructor(moduleTarget = null) {
    this.projectRoot = this.findProjectRoot();
    this.projectConfig = null;
    if (moduleTarget) {
        this.hashFile = path.join(this.projectRoot, '.cdd', `hashes_${moduleTarget}.csv`);
    } else {
        this.hashFile = path.join(this.projectRoot, '.cdd', 'hashes.csv');
    }
  }

  // Find the project root by looking for project.cdd
  findProjectRoot() {
    let currentDir = process.cwd();
    while (true) {
      if (fs.existsSync(path.join(currentDir, 'project.cdd'))) {
        return currentDir;
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached root without finding project.cdd
        return process.cwd(); // Fallback to CWD to let loadProjectConfig throw the standard error
      }
      currentDir = parentDir;
    }
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
          // Support buildTool and other custom properties automatically
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
      components: [], // Backwards compatibility: includes components, services, screens, widgets
      screens: [],
      widgets: [],
      flows: [],
      aspects: []
    };

    const lines = content.split('\n');
    let currentSection = null;
    let currentBlock = null;
    let currentMethod = null;
    let pendingDoc = null;
    let inDocComment = false;
    const docLines = [];

    // Multiline string state
    let inMultilineString = false;
    let multilineStringAccumulator = [];
    let multilineStringTarget = null; // 'method' or 'block'

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

    const processCode = (code, originalLine) => {
      if (code === null || code === undefined) {
        return;
      }

      const trimmed = code.trim();

      if (trimmed === '') {
        return;
      }

      // Handle Multiline String Content
      if (inMultilineString) {
        if (trimmed.endsWith('"""') && trimmed !== '"""') {
           // Ends on same line with content before it
           multilineStringAccumulator.push(trimmed.slice(0, -3));
           inMultilineString = false;
        } else if (trimmed === '"""') {
           // Ends on this line
           inMultilineString = false;
        } else {
           // Middle of string
           multilineStringAccumulator.push(originalLine ? originalLine.trim() : trimmed);
           return;
        }

        if (!inMultilineString) {
           const finalDesc = multilineStringAccumulator.join('\n');
           if (multilineStringTarget === 'method' && currentMethod) {
              const combined = currentMethod.description ? `${currentMethod.description}\n${finalDesc}` : finalDesc;
              currentMethod.description = combined;
              currentMethod.hash = this.calculateHash(
                `${currentMethod.name}(${currentMethod.params.join(',')}):${currentMethod.returnType}:${currentMethod.description}`
              );
           } else if (multilineStringTarget === 'block' && currentBlock) {
              const combined = currentBlock.description ? `${currentBlock.description}\n${finalDesc}` : finalDesc;
              currentBlock.description = combined;
           }
           multilineStringAccumulator = [];
           multilineStringTarget = null;
        }
        return;
      }

      if (trimmed.startsWith('//')) {
        currentMethod = null;
        return;
      }

      // 1. Detect Block Types
      if (
        (trimmed.startsWith('component ') || trimmed.startsWith('service ') || 
         trimmed.startsWith('screen ') || trimmed.startsWith('widget ')) &&
        trimmed.includes('{')
      ) {
        const match = trimmed.match(/^(?:component|service|screen|widget)\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_<>,.]+))?/);
        if (match) {
          const type = trimmed.split(' ')[0]; // component, service, screen, widget
          currentSection = 'component'; // We group them all under components for processing logic
          currentBlock = {
            name: match[1],
            extends: match[2] || null,
            type: type, // Store specific type
            description: pendingDoc || '',
            methods: [],
            props: [],
            state: [],
            connections: []
          };
        } else {
          currentSection = null;
          currentBlock = null;
        }
        pendingDoc = null;
        currentMethod = null;
        return;
      }

      if (trimmed.startsWith('flow ') && trimmed.includes('{')) {
        const match = trimmed.match(/^flow\s+([A-Za-z0-9_]+)/);
        if (match) {
          currentSection = 'flow';
          currentBlock = {
            name: match[1],
            type: 'flow',
            description: pendingDoc || '',
            routes: [],
            start: null
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
            // Sort into specific arrays based on type
            if (currentBlock.type === 'screen') {
              parsed.screens.push(currentBlock);
            } else if (currentBlock.type === 'widget') {
              parsed.widgets.push(currentBlock);
            }
            // Always add to generic components array for backward compat/general processing
            parsed.components.push(currentBlock);
          } else if (currentSection === 'flow') {
            parsed.flows.push(currentBlock);
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

      // Handle descriptions
      if (trimmed.startsWith('description:')) {
        const content = trimmed.substring(12).trim();
        
        // Check for multiline start
        if (content.startsWith('"""')) {
           if (content.length > 3 && content.endsWith('"""')) {
             // One-line triple quote: description: """foo"""
             const descValue = content.slice(3, -3);
             const combined = pendingDoc ? `${pendingDoc}\n${descValue}`.trim() : descValue;
             if (currentMethod) {
                currentMethod.description = combined;
                currentMethod.hash = this.calculateHash(`${currentMethod.name}(${currentMethod.params.join(',')}):${currentMethod.returnType}:${currentMethod.description}`);
             } else {
                currentBlock.description = combined;
             }
           } else {
             // Start of multiline
             inMultilineString = true;
             multilineStringTarget = currentMethod ? 'method' : 'block';
             const remainder = content.substring(3).trim();
             if (remainder) {
                multilineStringAccumulator.push(remainder);
             }
           }
           pendingDoc = null;
           return;
        }
        
        // Standard single line
        if (currentMethod) {
            const descValue = content.replace(/^['"]|['"]$/g, '');
            const combined = pendingDoc ? `${pendingDoc}\n${descValue}`.trim() : descValue;
            currentMethod.description = combined;
            currentMethod.hash = this.calculateHash(
              `${currentMethod.name}(${currentMethod.params.join(',')}):${currentMethod.returnType}:${currentMethod.description}`
            );
            pendingDoc = null;
            return;
        }

        const descValue = content.replace(/^['"]|['"]$/g, '');
        const combined = pendingDoc ? `${pendingDoc}\n${descValue}`.trim() : descValue;
        currentBlock.description = combined;
        pendingDoc = null;
        currentMethod = null;
        return;
      }

      // 2. Parse Component/Screen/Widget internals
      if (currentSection === 'component') {
        // Parse 'prop name: Type'
        if (trimmed.startsWith('prop ')) {
          const propPart = trimmed.substring(5).trim();
          if (propPart.includes(':')) {
            const colonIndex = propPart.indexOf(':');
            const name = propPart.slice(0, colonIndex).trim();
            let type = propPart.slice(colonIndex + 1).trim();
            if (type.endsWith(';')) type = type.slice(0, -1).trim();
            
            const prop = { name, type, description: pendingDoc || '' };
            prop.hash = this.calculateHash(`prop:${prop.name}:${prop.type}:${prop.description}`);
            currentBlock.props.push(prop);
          }
          pendingDoc = null;
          return;
        }

        // Parse 'state name: Type'
        if (trimmed.startsWith('state ')) {
          const statePart = trimmed.substring(6).trim();
          if (statePart.includes(':')) {
            const colonIndex = statePart.indexOf(':');
            const name = statePart.slice(0, colonIndex).trim();
            let type = statePart.slice(colonIndex + 1).trim();
            if (type.endsWith(';')) type = type.slice(0, -1).trim();
            
            const state = { name, type, description: pendingDoc || '' };
            state.hash = this.calculateHash(`state:${state.name}:${state.type}:${state.description}`);
            currentBlock.state.push(state);
          }
          pendingDoc = null;
          return;
        }

        // Parse 'connect Trigger -> Target'
        if (trimmed.startsWith('connect ')) {
          const connectPart = trimmed.substring(8).trim();
          if (connectPart.includes('->')) {
            const [trigger, target] = connectPart.split('->').map(s => s.trim().replace(/;$/, ''));
            const connection = { trigger, target, description: pendingDoc || '' };
            connection.hash = this.calculateHash(`connect:${connection.trigger}:${connection.target}`);
            currentBlock.connections.push(connection);
          }
          pendingDoc = null;
          return;
        }

        // Parse generic field (e.g. name: Type) as prop if no other prefix
        if (trimmed.includes(':') && !trimmed.startsWith('description:') && !trimmed.startsWith('connect ') && !trimmed.startsWith('func ') && !trimmed.startsWith('prop ') && !trimmed.startsWith('state ')) {
          const colonIndex = trimmed.indexOf(':');
          const name = trimmed.slice(0, colonIndex).trim();
          let type = trimmed.slice(colonIndex + 1).trim();
          if (type.endsWith(';')) type = type.slice(0, -1).trim();
          
          if (name && type && !name.includes(' ')) {
            const prop = { name, type, description: pendingDoc || '' };
            prop.hash = this.calculateHash(`prop:${prop.name}:${prop.type}:${prop.description}`);
            currentBlock.props.push(prop);
            pendingDoc = null;
            return;
          }
        }

        // Parse functions (methods)
        if (trimmed.startsWith('func ')) {
          const signature = trimmed.replace(/;\s*$/, '');
          // Support: func name(params) : Type, func name(params) -> Type, or just func name(params)
          let methodMatch = signature.match(
            /^func\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*(?::|->)\s*([A-Za-z0-9_<>,.\[\]| ]+))?$/
          );
          let method = null;

          if (methodMatch) {
            method = {
              name: methodMatch[1],
              params: methodMatch[2] ? methodMatch[2].split(',').map(p => p.trim()).filter(Boolean) : [],
              returnType: (methodMatch[3] || 'void').trim()
            };
          } else {
            // Alternative syntax: func Type name()
            methodMatch = signature.match(
              /^func\s+([A-Za-z0-9_<>,.\[\]| ]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)$/
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
      }

      // 3. Parse Flow internals
      if (currentSection === 'flow') {
        if (trimmed.startsWith('start:')) {
          currentBlock.start = trimmed.substring(6).trim().replace(/;$/, '');
        } else if (trimmed.startsWith('route ')) {
          const routePart = trimmed.substring(6).trim();
          if (routePart.includes('->')) {
            const [source, target] = routePart.split('->').map(s => s.trim().replace(/;$/, ''));
            const route = { source, target, description: pendingDoc || '' };
            route.hash = this.calculateHash(`route:${route.source}:${route.target}:${route.description}`);
            currentBlock.routes.push(route);
          }
        }
        pendingDoc = null;
        return;
      }

      // 4. Parse Data internals
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

      // 5. Parse Aspect internals
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

      // Handle multiline string specifically first before any doc comment logic
      if (inMultilineString) {
          processCode(remainder, line); // Use original line to preserve whitespace if needed
          continue;
      }

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
            processCode(remainder, line);
          }
          remainder = null;
        } else {
          const before = remainder.slice(0, startIndex);
          processCode(before, line);
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
    // Filter contracts by module if specified
    const filteredContracts = moduleFilter
      ? contracts.filter(c => c.package === moduleFilter || c.name.startsWith(`${moduleFilter}.`))
      : contracts;

    const changes = {
      added: [],
      modified: [],
      unchanged: [],
      all: filteredContracts
    };

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
          hashes: currentHashes,
          changedElements: ['*'] // All elements are new
        });
      } else {
        // Compare hashes
        const stored = storedHashes[contractKey];
        const comparison = this.compareHashes(stored, currentHashes);

        if (comparison.isModified) {
          changes.modified.push({
            contract,
            parsed,
            hashes: currentHashes,
            previousHashes: stored,
            changedElements: comparison.changedItems
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
      flows: {},
      aspects: {},
      lastUpdated: new Date().toISOString()
    };

    // Extract data hashes
    for (const data of parsed.data) {
      hashes.data[data.name] = {};
      // Calculate a composite hash for the data entity itself to track structural changes
      let entityStr = `name:${data.name}`;
      if (data.extends) {
        hashes.data[data.name].extends = data.extends;
        entityStr += `:extends:${data.extends}`;
      }
      if (data.description) {
        hashes.data[data.name].__description = this.calculateHash(`${data.name}:${data.description}`);
        entityStr += `:desc:${data.description}`;
      }
      for (const field of data.fields) {
        hashes.data[data.name][field.name] = field.hash;
        if (field.description) {
          hashes.data[data.name][`${field.name}.__description`] = this.calculateHash(`${field.name}:${field.description}`);
        }
        entityStr += `:field:${field.name}:${field.hash}`;
      }
      hashes.data[data.name].__self = this.calculateHash(entityStr);
    }

    // Extract component/screen/widget hashes
    for (const component of parsed.components) {
      hashes.components[component.name] = {}; 
      let entityStr = `name:${component.name}:type:${component.type}`;
      
      if (component.extends) {
        hashes.components[component.name].extends = component.extends;
        entityStr += `:extends:${component.extends}`;
      }
      
      if (component.description) {
        hashes.components[component.name].__description = this.calculateHash(`${component.name}:${component.description}`);
        entityStr += `:desc:${component.description}`;
      }
      
      // Hash methods
      for (const method of component.methods) {
        hashes.components[component.name][method.name] = method.hash;
        if (method.description) {
          hashes.components[component.name][`${method.name}.__description`] = this.calculateHash(`${method.name}:${method.description}`);
        }
        entityStr += `:method:${method.name}:${method.hash}`;
      }

      // Hash props
      for (const prop of component.props) {
        hashes.components[component.name][`prop:${prop.name}`] = prop.hash;
        entityStr += `:prop:${prop.name}:${prop.hash}`;
      }

      // Hash state
      for (const state of component.state) {
        hashes.components[component.name][`state:${state.name}`] = state.hash;
        entityStr += `:state:${state.name}:${state.hash}`;
      }

      // Hash connections
      for (const conn of component.connections) {
        hashes.components[component.name][`connect:${conn.trigger}`] = conn.hash;
        entityStr += `:connect:${conn.trigger}:${conn.hash}`;
      }
      
      hashes.components[component.name].__self = this.calculateHash(entityStr);
    }

    // Extract flow hashes
    if (parsed.flows) {
      for (const flow of parsed.flows) {
        hashes.flows[flow.name] = {};
        let entityStr = `name:${flow.name}`;
        
        if (flow.description) {
          hashes.flows[flow.name].__description = this.calculateHash(`${flow.name}:${flow.description}`);
          entityStr += `:desc:${flow.description}`;
        }
        if (flow.start) {
          hashes.flows[flow.name].start = flow.start;
          entityStr += `:start:${flow.start}`;
        }
        for (const route of flow.routes) {
          hashes.flows[flow.name][`route:${route.source}:${route.target}`] = route.hash;
          entityStr += `:route:${route.source}:${route.target}:${route.hash}`;
        }
        hashes.flows[flow.name].__self = this.calculateHash(entityStr);
      }
    }

    // Extract aspect hashes
    for (const aspect of parsed.aspects) {
      const descriptionPart = aspect.description ? `:${aspect.description}` : '';
      const aspectHash = this.calculateHash(`${aspect.name}:${JSON.stringify(aspect.properties)}${descriptionPart}`);
      hashes.aspects[aspect.name] = {
        hash: aspectHash,
        __self: aspectHash
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
        currentContract = parts.slice(1).join(':'); 
        currentSection = null;
        hashes[currentContract] = {
          contract: currentContract,
          data: {},
          components: {},
          flows: {},
          aspects: {},
          lastUpdated: null
        };
      } else if (line.startsWith('section:')) {
        currentSection = line.split(':')[1];
      } else if (line.includes(',') && currentContract && currentSection) {
        const [key, hash] = line.split(',');
        
        if (currentSection === 'data' || currentSection === 'components' || currentSection === 'flows') {
          // Handle nested keys e.g. "Component.method"
          // We look for the FIRST dot to separate Item from Field
          // But some keys might contain colons "prop:name", so we have to be careful
          
          const dotIndex = key.indexOf('.');
          if (dotIndex > 0) {
            const item = key.substring(0, dotIndex);
            const field = key.substring(dotIndex + 1);
            
            if (!hashes[currentContract][currentSection][item]) {
              hashes[currentContract][currentSection][item] = {};
            }
            hashes[currentContract][currentSection][item][field] = hash;
          }
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
    const changedItems = [];
    let isModified = false;

    // Helper to check section changes
    const checkSection = (sectionName) => {
      const storedSection = stored[sectionName] || {};
      const currentSection = current[sectionName] || {};
      
      const allKeys = new Set([...Object.keys(storedSection), ...Object.keys(currentSection)]);
      
      for (const key of allKeys) {
        const storedItem = storedSection[key];
        const currentItem = currentSection[key];
        
        // Item added or removed
        if (!storedItem || !currentItem) {
          changedItems.push(`${sectionName}:${key}`);
          isModified = true;
          continue;
        }

        // Check internal hash (composite hash of the item)
        // We added __self in extractHashes to make this easier
        if (currentItem.__self && storedItem.__self) {
           if (currentItem.__self !== storedItem.__self) {
              changedItems.push(`${sectionName}:${key}`);
              isModified = true;
           }
        } else {
           // Fallback for backward compatibility or missing __self: deep compare
           // Exclude __self from storedItem if it exists but not in currentItem (edge case)
           const sCopy = { ...storedItem }; delete sCopy.__self;
           const cCopy = { ...currentItem }; delete cCopy.__self;
           
           if (JSON.stringify(sCopy) !== JSON.stringify(cCopy)) {
              changedItems.push(`${sectionName}:${key}`);
              isModified = true;
           }
        }
      }
    };

    checkSection('data');
    checkSection('components');
    checkSection('flows');
    checkSection('aspects');

    return { isModified, changedItems };
  }

  // Generate and save hashes for contracts after implementation
  generateHashes(contracts, moduleFilter = null) {
    let allHashes = this.loadHashes();
    
    // If filtering by module, we should start with an empty object or filtered object
    // to avoid carrying over other modules' hashes into this module-specific file
    if (moduleFilter) {
        // Filter out existing hashes that don't match the module
        // This effectively "cleans" the file of unrelated module data
        const filteredHashes = {};
        for (const key in allHashes) {
            if (key.startsWith(`${moduleFilter}:`)) {
                filteredHashes[key] = allHashes[key];
            }
        }
        allHashes = filteredHashes;
    }

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
          csv += `${dataName}.${fieldName},${data[fieldName]}\n`;
        }
      }

      // Write components/screens/widgets
      for (const componentName in contractHash.components) {
        csv += `section:components\n`;
        const component = contractHash.components[componentName];
        for (const key in component) {
          if (key === 'type') continue; // Don't save metadata as hash
          csv += `${componentName}.${key},${component[key]}\n`;
        }
      }

      // Write flows
      if (contractHash.flows) {
        for (const flowName in contractHash.flows) {
          csv += `section:flows\n`;
          const flow = contractHash.flows[flowName];
          for (const key in flow) {
             csv += `${flowName}.${key},${flow[key]}\n`;
          }
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

  // Recursively remove hash fields from an object
  stripHashes(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.stripHashes(item));
    } else if (typeof obj === 'object' && obj !== null) {
      const newObj = {};
      for (const key in obj) {
        if (key === 'hash' || key === '__self') continue;
        newObj[key] = this.stripHashes(obj[key]);
      }
      return newObj;
    }
    return obj;
  }

  // Get project context for prompts
  getProjectContext(moduleTarget = null) {
    if (!this.projectConfig) {
      this.loadProjectConfig();
    }
    
    // Use moduleTarget to filter contracts
    let contracts = this.loadContracts();
    if (moduleTarget) {
       contracts = contracts.filter(c => c.package === moduleTarget);
    }

    // Filter modules in config if target specified
    let projectConfig = this.projectConfig;
    if (moduleTarget && projectConfig.modules) {
        projectConfig = { ...projectConfig, modules: {} };
        if (this.projectConfig.modules[moduleTarget]) {
            projectConfig.modules[moduleTarget] = this.projectConfig.modules[moduleTarget];
        }
    }

    return {
      project: projectConfig,
      projectRoot: this.projectRoot,
      contracts: contracts,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = CDDUtils;