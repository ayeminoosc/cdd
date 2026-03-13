import * as vscode from 'vscode';

type LogiDefinitionKind =
  | 'module'
  | 'type'
  | 'failure'
  | 'usecase'
  | 'component'
  | 'widget'
  | 'screen'
  | 'flow'
  | 'job'
  | 'system_event'
  | 'state'
  | 'prop'
  | 'event'
  | 'action'
  | 'field'
  | 'param';

interface LogiDefinition {
  name: string;
  kind: LogiDefinitionKind;
  uri: vscode.Uri;
  range: vscode.Range;
  containerName?: string;
  containerKind?: LogiDefinitionKind;
  declaredType?: string;
}

interface LogiScope {
  name: string;
  kind: LogiDefinitionKind;
  startLine: number;
  endLine: number;
}

interface ParsedLogiDocument {
  definitions: LogiDefinition[];
  scopes: LogiScope[];
}

interface BlockFrame {
  kind: string;
  name?: string;
  definitionKind?: LogiDefinitionKind;
  startLine: number;
}

interface TokenPropertyLine {
  key: string;
  value: string;
  indentLevel: number;
}

const LOGI_TOP_LEVEL_PATTERN = /^(module|type|failure|usecase|component|widget|screen|flow|job|system_event)\s+([a-z_][a-z0-9_]*)\b/;
const LOGI_LOCAL_PATTERN = /^(state|prop|event|action)\s+([a-z_][a-z0-9_]*)\b/;
const LOGI_FIELD_PATTERN = /^([a-z_][a-z0-9_]*)\s*:\s*([a-z_][a-z0-9_]*(?:\[\]|\?)?)/;
const LOGI_PARAM_TYPE_PATTERN = /^([a-z_][a-z0-9_]*)\s*:\s*([a-z_][a-z0-9_]*(?:\[\]|\?)?)$/;
const LOGI_REFERENCE_PATTERN = /\{([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*)\}/g;
const LOGI_QUALIFIED_NAME_PATTERN = /\b[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*\b/g;
const LOGI_BLOCK_START_PATTERN = /^(type|failure|usecase|component|widget|screen|flow|job|when|each|repeat)\b/;
const LOGI_DECLARATION_START_PATTERN = /^(module|type|failure|usecase|component|widget|screen|flow|job|system_event)\b/;

const LOGID_BLOCK_START_PATTERN = /^(tokens|style|variant|theme|motion|color|font|space|radius|shadow|size|border|hover|active|focus|disabled|selected|loading|error|on (mobile|tablet|desktop)|\.[a-z_][a-z0-9_]*)\b/;
const LOGID_TOP_LEVEL_PATTERN = /^(tokens|style|variant|theme|motion)\b/;
const LOGID_TOKEN_CATEGORY_PATTERN = /^(color|font|space|radius|shadow|size|border|motion)\b/;
const LOGID_PROPERTY_PATTERN = /^([a-z_][a-z0-9_]*):(.+)$/;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('logi', {
      provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        return [replaceWholeDocument(document, formatLogiDocument(document))];
      }
    })
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('logid', {
      provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        return [replaceWholeDocument(document, formatLogidDocument(document))];
      }
    })
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider('logi', {
      async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
      ): Promise<vscode.Location[] | undefined> {
        const reference = getReferenceAtPosition(document, position);
        if (!reference) {
          return undefined;
        }

        const index = await buildWorkspaceIndex();
        return resolveDefinitionLocations(index, document, position, reference);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('logi.format', async () => {
      await vscode.commands.executeCommand('editor.action.formatDocument');
    })
  );
}

export function deactivate() {}

function replaceWholeDocument(document: vscode.TextDocument, newText: string): vscode.TextEdit {
  const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
  return vscode.TextEdit.replace(fullRange, newText);
}

function formatLogiDocument(document: vscode.TextDocument): string {
  const config = vscode.workspace.getConfiguration('logi.formatting');
  const indentSize = config.get<number>('indentSize', 2);
  const blankLinesBetweenBlocks = config.get<boolean>('blankLinesBetweenBlocks', true);
  const lines = document.getText().split(/\r?\n/);
  const formatted: string[] = [];
  let indentLevel = 0;
  let previousLineWasBlank = false;
  let isContinuation = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === '') {
      if (!previousLineWasBlank && formatted.length > 0) {
        formatted.push('');
      }
      previousLineWasBlank = true;
      isContinuation = false;
      continue;
    }

    previousLineWasBlank = false;

    if (!isContinuation && blankLinesBetweenBlocks && shouldInsertLogiBlankLine(formatted, line, indentLevel)) {
      formatted.push('');
    }

    if (!isContinuation && line === 'end') {
      indentLevel = Math.max(0, indentLevel - 1);
      formatted.push(indent(line, indentLevel, indentSize));
      isContinuation = false;
      continue;
    }

    if (!isContinuation && line === 'otherwise') {
      indentLevel = Math.max(0, indentLevel - 1);
      formatted.push(indent(line, indentLevel, indentSize));
      indentLevel += 1;
      isContinuation = false;
      continue;
    }

    const extraIndent = isContinuation ? 1 : 0;
    formatted.push(indent(line, indentLevel + extraIndent, indentSize));

    isContinuation = line.endsWith('\\');
    if (!isContinuation && LOGI_BLOCK_START_PATTERN.test(line)) {
      indentLevel += 1;
    }
  }

  return formatted.join('\n');
}

function formatLogidDocument(document: vscode.TextDocument): string {
  const config = vscode.workspace.getConfiguration('logi.formatting');
  const indentSize = config.get<number>('indentSize', 2);
  const alignColons = config.get<boolean>('alignColons', true);
  const blankLinesBetweenBlocks = config.get<boolean>('blankLinesBetweenBlocks', true);
  const lines = document.getText().split(/\r?\n/);
  const formatted: string[] = [];
  const blockStack: string[] = [];
  let previousLineWasBlank = false;
  let tokenPropertyLines: TokenPropertyLine[] = [];

  const flushTokenPropertyLines = () => {
    if (tokenPropertyLines.length === 0) {
      return;
    }

    const maxKeyLength = alignColons ? Math.max(...tokenPropertyLines.map((entry) => entry.key.length)) : 0;

    for (const entry of tokenPropertyLines) {
      const padding = alignColons ? ' '.repeat(maxKeyLength - entry.key.length) : '';
      const output = alignColons
        ? `${entry.key}:${padding} ${entry.value}`
        : `${entry.key}: ${entry.value}`;
      formatted.push(indent(output, entry.indentLevel, indentSize));
    }

    tokenPropertyLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const indentLevel = blockStack.length;

    if (line === '') {
      flushTokenPropertyLines();
      if (!previousLineWasBlank && formatted.length > 0) {
        formatted.push('');
      }
      previousLineWasBlank = true;
      continue;
    }

    previousLineWasBlank = false;

    if (line === 'end') {
      flushTokenPropertyLines();
      blockStack.pop();
      formatted.push(indent(line, blockStack.length, indentSize));
      continue;
    }

    const insideTokenCategory = blockStack[blockStack.length - 1] === 'token-category';
    const propertyMatch = line.match(LOGID_PROPERTY_PATTERN);
    if (insideTokenCategory && propertyMatch) {
      tokenPropertyLines.push({
        key: propertyMatch[1],
        value: propertyMatch[2].trim(),
        indentLevel
      });
      continue;
    }

    flushTokenPropertyLines();

    if (blankLinesBetweenBlocks && shouldInsertLogidBlankLine(formatted, line, blockStack.length)) {
      formatted.push('');
    }

    if (propertyMatch) {
      formatted.push(indent(`${propertyMatch[1]}: ${propertyMatch[2].trim()}`, indentLevel, indentSize));
    } else {
      formatted.push(indent(line, indentLevel, indentSize));
    }

    const blockKind = classifyLogidBlock(line);
    if (blockKind) {
      blockStack.push(blockKind);
    }
  }

  flushTokenPropertyLines();
  return formatted.join('\n');
}

function shouldInsertLogiBlankLine(formatted: string[], line: string, indentLevel: number): boolean {
  if (!LOGI_DECLARATION_START_PATTERN.test(line)) {
    return false;
  }

  if (formatted.length === 0 || formatted[formatted.length - 1] === '') {
    return false;
  }

  // Don't insert a blank line between an annotation and its declaration
  const lastNonEmpty = [...formatted].reverse().find(l => l.trim() !== '');
  if (lastNonEmpty && lastNonEmpty.trim().startsWith('@')) {
    return false;
  }

  return indentLevel === 0;
}

function shouldInsertLogidBlankLine(formatted: string[], line: string, indentLevel: number): boolean {
  if (!LOGID_TOP_LEVEL_PATTERN.test(line)) {
    return false;
  }

  if (formatted.length === 0 || formatted[formatted.length - 1] === '') {
    return false;
  }

  return indentLevel === 0;
}

function classifyLogidBlock(line: string): string | null {
  if (!LOGID_BLOCK_START_PATTERN.test(line)) {
    return null;
  }

  if (LOGID_TOKEN_CATEGORY_PATTERN.test(line)) {
    return 'token-category';
  }

  return 'block';
}

function indent(text: string, indentLevel: number, indentSize: number): string {
  return `${' '.repeat(Math.max(0, indentLevel) * indentSize)}${text}`;
}

async function buildWorkspaceIndex(): Promise<Map<string, ParsedLogiDocument>> {
  const documents = new Map<string, ParsedLogiDocument>();
  const uris = await vscode.workspace.findFiles('**/*.logi', '**/node_modules/**');

  for (const uri of uris) {
    const document = await vscode.workspace.openTextDocument(uri);
    documents.set(uri.toString(), parseLogiDocument(document));
  }

  return documents;
}

function parseLogiDocument(document: vscode.TextDocument): ParsedLogiDocument {
  const definitions: LogiDefinition[] = [];
  const scopes: LogiScope[] = [];
  const stack: BlockFrame[] = [];

  for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber += 1) {
    const rawLine = document.lineAt(lineNumber).text;
    const line = rawLine.trim();

    if (line === '' || line.startsWith('#')) {
      continue;
    }

    if (line === 'end') {
      const frame = stack.pop();
      if (frame?.name && frame.definitionKind) {
        scopes.push({
          name: frame.name,
          kind: frame.definitionKind,
          startLine: frame.startLine,
          endLine: lineNumber
        });
      }
      continue;
    }

    const currentContainer = getCurrentContainer(stack);
    const topLevelMatch = line.match(LOGI_TOP_LEVEL_PATTERN);
    if (topLevelMatch) {
      const kind = topLevelMatch[1] as LogiDefinitionKind;
      const name = topLevelMatch[2];
      definitions.push(createDefinition(document.uri, lineNumber, rawLine, name, kind));
      parseParamsFromDeclaration(document.uri, lineNumber, rawLine, line, kind, name, definitions);
      stack.push({ kind, name, definitionKind: kind, startLine: lineNumber });
      continue;
    }

    const localMatch = line.match(LOGI_LOCAL_PATTERN);
    if (localMatch && currentContainer) {
      const kind = localMatch[1] as LogiDefinitionKind;
      const name = localMatch[2];
      const declaredType = parseDeclaredType(line);
      definitions.push(createDefinition(document.uri, lineNumber, rawLine, name, kind, currentContainer.name, currentContainer.definitionKind, declaredType));
      parseParamsFromLocalDeclaration(document.uri, lineNumber, rawLine, line, kind, name, currentContainer, definitions);
      continue;
    }

    if (currentContainer && (currentContainer.definitionKind === 'type' || currentContainer.definitionKind === 'failure')) {
      const fieldMatch = line.match(LOGI_FIELD_PATTERN);
      if (fieldMatch) {
        definitions.push(
          createDefinition(
            document.uri,
            lineNumber,
            rawLine,
            fieldMatch[1],
            'field',
            currentContainer.name,
            currentContainer.definitionKind,
            normalizeTypeRef(fieldMatch[2])
          )
        );
      }
    }

    if (/^(when|each|repeat)\b/.test(line)) {
      stack.push({ kind: line.split(/\s+/)[0], startLine: lineNumber });
    }
  }

  return { definitions, scopes };
}

function createDefinition(
  uri: vscode.Uri,
  lineNumber: number,
  rawLine: string,
  name: string,
  kind: LogiDefinitionKind,
  containerName?: string,
  containerKind?: LogiDefinitionKind,
  declaredType?: string
): LogiDefinition {
  const startCharacter = rawLine.indexOf(name);
  const range = new vscode.Range(
    new vscode.Position(lineNumber, Math.max(0, startCharacter)),
    new vscode.Position(lineNumber, Math.max(0, startCharacter) + name.length)
  );

  return {
    name,
    kind,
    uri,
    range,
    containerName,
    containerKind,
    declaredType
  };
}

function parseParamsFromDeclaration(
  uri: vscode.Uri,
  lineNumber: number,
  rawLine: string,
  line: string,
  kind: LogiDefinitionKind,
  name: string,
  definitions: LogiDefinition[]
): void {
  if (kind === 'usecase' || kind === 'job') {
    const match = line.match(/\bfor\s+(.+?)(?:\s+returns\s+[a-z_][a-z0-9_]*(?:\[\]|\?)?)?$/);
    if (match) {
      addParamDefinitions(uri, lineNumber, rawLine, match[1], kind, name, definitions);
    }
  }

  if (kind === 'system_event') {
    const match = line.match(/\((.*)\)$/);
    if (match) {
      addParamDefinitions(uri, lineNumber, rawLine, match[1], kind, name, definitions);
    }
  }
}

function parseParamsFromLocalDeclaration(
  uri: vscode.Uri,
  lineNumber: number,
  rawLine: string,
  line: string,
  kind: LogiDefinitionKind,
  name: string,
  currentContainer: BlockFrame,
  definitions: LogiDefinition[]
): void {
  if (kind !== 'event' || !currentContainer.name || !currentContainer.definitionKind) {
    return;
  }

  const match = line.match(/\((.*)\)$/);
  if (!match) {
    return;
  }

  addParamDefinitions(
    uri,
    lineNumber,
    rawLine,
    match[1],
    kind,
    name,
    definitions,
    currentContainer.name,
    currentContainer.definitionKind
  );
}

function addParamDefinitions(
  uri: vscode.Uri,
  lineNumber: number,
  rawLine: string,
  paramText: string,
  ownerKind: LogiDefinitionKind,
  ownerName: string,
  definitions: LogiDefinition[],
  containerName?: string,
  containerKind?: LogiDefinitionKind
): void {
  const params = paramText
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const param of params) {
    const match = param.match(LOGI_PARAM_TYPE_PATTERN);
    if (!match) {
      continue;
    }

    const name = match[1];
    const declaredType = normalizeTypeRef(match[2]);
    definitions.push(
      createDefinition(
        uri,
        lineNumber,
        rawLine,
        name,
        'param',
        containerName ?? ownerName,
        containerKind ?? ownerKind,
        declaredType
      )
    );
  }
}

function parseDeclaredType(line: string): string | undefined {
  const match = line.match(/:\s*([a-z_][a-z0-9_]*(?:\[\]|\?)?)/);
  return match ? normalizeTypeRef(match[1]) : undefined;
}

function normalizeTypeRef(typeRef: string): string {
  return typeRef.replace(/(\[\]|\?)$/, '');
}

function getCurrentContainer(stack: BlockFrame[]): BlockFrame | undefined {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].name && stack[index].definitionKind) {
      return stack[index];
    }
  }

  return undefined;
}

function getReferenceAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
  const line = document.lineAt(position.line).text;

  for (const match of line.matchAll(LOGI_REFERENCE_PATTERN)) {
    const start = match.index ?? 0;
    const fullText = match[0];
    const end = start + fullText.length;
    if (position.character >= start && position.character <= end) {
      return match[1];
    }
  }

  for (const match of line.matchAll(LOGI_QUALIFIED_NAME_PATTERN)) {
    const start = match.index ?? 0;
    const fullText = match[0];
    const end = start + fullText.length;
    if (position.character >= start && position.character <= end) {
      return fullText;
    }
  }

  return undefined;
}

function resolveDefinitionLocations(
  index: Map<string, ParsedLogiDocument>,
  document: vscode.TextDocument,
  position: vscode.Position,
  reference: string
): vscode.Location[] | undefined {
  const current = index.get(document.uri.toString()) ?? parseLogiDocument(document);
  const allDefinitions = Array.from(index.values()).flatMap((entry) => entry.definitions);
  const segments = reference.split('.');
  const rootName = segments[0];
  const scope = findInnermostScope(current.scopes, position.line);
  const localMatches = current.definitions.filter(
    (definition) =>
      definition.name === rootName &&
      definition.containerName === scope?.name &&
      definition.containerKind === scope?.kind
  );

  const candidates = localMatches.length > 0
    ? localMatches
    : allDefinitions.filter((definition) => definition.name === rootName && !definition.containerName);

  if (candidates.length === 0) {
    return undefined;
  }

  const locations = new Map<string, vscode.Location>();
  for (const candidate of candidates) {
    const resolved = resolveQualifiedReference(candidate, segments.slice(1), allDefinitions);
    const key = `${resolved.uri.toString()}:${resolved.range.start.line}:${resolved.range.start.character}`;
    locations.set(key, new vscode.Location(resolved.uri, resolved.range));
  }

  return Array.from(locations.values());
}

function findInnermostScope(scopes: LogiScope[], lineNumber: number): LogiScope | undefined {
  return scopes
    .filter((scope) => lineNumber >= scope.startLine && lineNumber <= scope.endLine)
    .sort((left, right) => (left.endLine - left.startLine) - (right.endLine - right.startLine))[0];
}

function resolveQualifiedReference(
  rootDefinition: LogiDefinition,
  remainingSegments: string[],
  allDefinitions: LogiDefinition[]
): LogiDefinition {
  let current = rootDefinition;
  let currentTypeName = deriveTypeName(current);

  for (const segment of remainingSegments) {
    const next = resolveFieldSegment(current, currentTypeName, segment, allDefinitions);
    if (!next) {
      break;
    }

    current = next;
    currentTypeName = deriveTypeName(current);
  }

  return current;
}

function deriveTypeName(definition: LogiDefinition): string | undefined {
  if (definition.kind === 'type' || definition.kind === 'failure') {
    return definition.name;
  }

  return definition.declaredType;
}

function resolveFieldSegment(
  current: LogiDefinition,
  currentTypeName: string | undefined,
  segment: string,
  allDefinitions: LogiDefinition[]
): LogiDefinition | undefined {
  if (current.kind === 'type' || current.kind === 'failure') {
    return allDefinitions.find(
      (definition) =>
        definition.kind === 'field' &&
        definition.containerName === current.name &&
        definition.name === segment
    );
  }

  if (!currentTypeName) {
    return undefined;
  }

  return allDefinitions.find(
    (definition) =>
      definition.kind === 'field' &&
      definition.containerName === currentTypeName &&
      definition.name === segment
  );
}
