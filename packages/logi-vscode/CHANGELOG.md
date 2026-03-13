# Change Log

All notable changes to the "Logi" extension will be documented in this file.

## [0.1.0] - 2026-03-13

### Initial Release

#### Features
- **Syntax Highlighting** for `.logi` files
  - Keywords: module, type, behavior, screen, widget, etc.
  - Built-in types: text, number, decimal, boolean, date, datetime
  - Comments, strings, and interpolation syntax
  - Type declarations and modifiers (?, [])

- **Syntax Highlighting** for `.logidesign` files
  - Tokens: color, font, space, radius, shadow, size
  - Styles with properties and child selectors
  - State blocks: hover, active, focus, disabled, selected, loading, error
  - Responsive blocks: on mobile, on tablet, on desktop
  - Theme definitions

- **Code Formatting**
  - Auto-indent based on block structure (configurable, default: 2 spaces)
  - Blank lines between top-level blocks (configurable)
  - Colon alignment in token definitions (configurable)
  - Smart handling of `end` keywords

- **Language Features**
  - Auto-close brackets and quotes
  - Comment toggling with `#`
  - Code folding for all block structures
  - Bracket matching

#### Configuration Options
- `logi.formatting.indentSize` - Number of spaces for indentation
- `logi.formatting.alignColons` - Align colons in token definitions
- `logi.formatting.blankLinesBetweenBlocks` - Add blank lines between blocks
