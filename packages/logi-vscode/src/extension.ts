import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Register formatter for Logi
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('logi', {
      provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        return formatLogiDocument(document);
      }
    })
  );

  // Register formatter for LogiDesign
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('logidesign', {
      provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        return formatLogiDesignDocument(document);
      }
    })
  );

  // Register format command
  context.subscriptions.push(
    vscode.commands.registerCommand('logi.format', async () => {
      await vscode.commands.executeCommand('editor.action.formatDocument');
    })
  );
}

export function deactivate() {}

function formatLogiDocument(document: vscode.TextDocument): vscode.TextEdit[] {
  const config = vscode.workspace.getConfiguration('logi.formatting');
  const indentSize = config.get<number>('indentSize', 2);
  const blankLines = config.get<boolean>('blankLinesBetweenBlocks', true);

  const lines = document.getText().split('\n');
  const formatted: string[] = [];
  let indentLevel = 0;
  let previousLineWasEnd = false;
  let previousLineWasBlank = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip multiple consecutive blank lines
    if (line === '') {
      if (!previousLineWasBlank) {
        formatted.push('');
        previousLineWasBlank = true;
      }
      continue;
    }

    previousLineWasBlank = false;

    // Handle 'end' keyword - dedent before adding
    if (line === 'end') {
      indentLevel = Math.max(0, indentLevel - 1);
      
      // Add blank line before 'end' if it closes a top-level block
      if (blankLines && indentLevel === 0 && formatted.length > 0 && formatted[formatted.length - 1] !== '') {
        formatted.push('');
      }
      
      formatted.push(' '.repeat(indentLevel * indentSize) + line);
      previousLineWasEnd = true;
      continue;
    }

    // Add blank line after 'end' of top-level blocks
    if (previousLineWasEnd && indentLevel === 0 && blankLines) {
      if (formatted.length > 0 && formatted[formatted.length - 1] !== '') {
        formatted.push('');
      }
    }
    previousLineWasEnd = false;

    // Check if line starts a new block
    const startsBlock = /^(module|type|failure|behavior|rule|screen|widget|when|otherwise|each|repeat|check|step|bind|show|hover|active|focus|disabled|selected|loading|error)\b/.test(line);
    
    // Add current line with proper indentation
    formatted.push(' '.repeat(indentLevel * indentSize) + line);

    // Increase indent after block-starting keywords
    if (startsBlock && !line.includes('end')) {
      indentLevel++;
    }
  }

  // Create edit that replaces entire document
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );

  return [vscode.TextEdit.replace(fullRange, formatted.join('\n'))];
}

function formatLogiDesignDocument(document: vscode.TextDocument): vscode.TextEdit[] {
  const config = vscode.workspace.getConfiguration('logi.formatting');
  const indentSize = config.get<number>('indentSize', 2);
  const alignColons = config.get<boolean>('alignColons', true);
  const blankLines = config.get<boolean>('blankLinesBetweenBlocks', true);

  const lines = document.getText().split('\n');
  const formatted: string[] = [];
  let indentLevel = 0;
  let previousLineWasEnd = false;
  let previousLineWasBlank = false;
  let inTokensBlock = false;
  let tokenLines: { key: string; value: string }[] = [];
  let maxKeyLength = 0;

  const flushTokenLines = () => {
    if (tokenLines.length === 0) return;

    for (const { key, value } of tokenLines) {
      if (alignColons) {
        const padding = ' '.repeat(maxKeyLength - key.length);
        formatted.push(' '.repeat((indentLevel - 1) * indentSize) + `  ${key}:${padding} ${value}`);
      } else {
        formatted.push(' '.repeat((indentLevel - 1) * indentSize) + `  ${key}: ${value}`);
      }
    }

    tokenLines = [];
    maxKeyLength = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip multiple consecutive blank lines
    if (line === '') {
      if (!previousLineWasBlank) {
        flushTokenLines();
        formatted.push('');
        previousLineWasBlank = true;
      }
      continue;
    }

    previousLineWasBlank = false;

    // Handle 'end' keyword
    if (line === 'end') {
      flushTokenLines();
      indentLevel = Math.max(0, indentLevel - 1);
      
      if (blankLines && indentLevel === 0 && formatted.length > 0 && formatted[formatted.length - 1] !== '') {
        formatted.push('');
      }
      
      formatted.push(' '.repeat(indentLevel * indentSize) + line);
      previousLineWasEnd = true;
      inTokensBlock = false;
      continue;
    }

    // Add blank line after 'end' of top-level blocks
    if (previousLineWasEnd && indentLevel === 0 && blankLines) {
      if (formatted.length > 0 && formatted[formatted.length - 1] !== '') {
        formatted.push('');
      }
    }
    previousLineWasEnd = false;

    // Check for token category (color, font, space, etc.)
    const isTokenCategory = /^(color|font|space|radius|shadow|size)$/.test(line);

    // Check if line is a property definition (key: value)
    const propertyMatch = line.match(/^([a-z_][a-z0-9_]*):(.+)$/);

    if (inTokensBlock && propertyMatch && indentLevel >= 2) {
      // Collect token lines for alignment
      const key = propertyMatch[1];
      const value = propertyMatch[2].trim();
      tokenLines.push({ key, value });
      maxKeyLength = Math.max(maxKeyLength, key.length);
      continue;
    } else {
      // Flush any pending token lines
      flushTokenLines();
    }

    // Check if line starts a new block
    const startsBlock = /^(tokens|style|theme|color|font|space|radius|shadow|size|hover|active|focus|disabled|selected|loading|error|on (mobile|tablet|desktop))\b/.test(line);

    // Track if we're entering tokens block
    if (line === 'tokens') {
      inTokensBlock = true;
    }

    // Add current line with proper indentation
    if (isTokenCategory && inTokensBlock) {
      formatted.push(' '.repeat(indentLevel * indentSize) + line);
    } else if (propertyMatch && !inTokensBlock) {
      // Regular property (not in tokens) - don't align
      formatted.push(' '.repeat(indentLevel * indentSize) + `${propertyMatch[1]}: ${propertyMatch[2].trim()}`);
    } else if (line.startsWith('.')) {
      // Child selector
      formatted.push(' '.repeat(indentLevel * indentSize) + line);
    } else {
      formatted.push(' '.repeat(indentLevel * indentSize) + line);
    }

    // Increase indent after block-starting keywords
    if (startsBlock && !line.includes('end')) {
      indentLevel++;
    }
  }

  // Flush any remaining token lines
  flushTokenLines();

  // Create edit that replaces entire document
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );

  return [vscode.TextEdit.replace(fullRange, formatted.join('\n'))];
}
