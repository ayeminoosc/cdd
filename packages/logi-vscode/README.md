# Logi Language Support

Syntax highlighting and formatting support for **Logi** and **LogiDesign** languages.

## Features

### Syntax Highlighting

- **Logi (`.logi`)**: Complete syntax highlighting for the logic-first intent language
  - Keywords: `module`, `type`, `behavior`, `screen`, `widget`, etc.
  - Built-in types: `text`, `number`, `decimal`, `boolean`, `date`, `datetime`
  - Comments, strings, interpolation `{expression}`
  - Operators and type modifiers

- **LogiDesign (`.logidesign`)**: Visual design language highlighting
  - Keywords: `tokens`, `style`, `theme`, `end`
  - Categories: `color`, `font`, `space`, `radius`, `shadow`, `size`
  - State blocks: `hover`, `active`, `focus`, `disabled`
  - Responsive: `on mobile`, `on tablet`, `on desktop`
  - Colors and property definitions

### Code Formatting

Automatic code formatting with configurable options:

- **Indentation**: Configurable spaces (default: 2)
- **Blank lines**: Between top-level blocks (configurable)
- **Colon alignment**: In token definitions (configurable for `.logidesign`)

### Language Features

- **Auto-close**: Automatic closing of brackets, quotes
- **Comment toggling**: Line comments with `#`
- **Code folding**: Fold blocks from keyword to `end`
- **Bracket matching**: Highlight matching brackets

## Usage

1. Create files with `.logi` or `.logidesign` extensions
2. Syntax highlighting applies automatically
3. Format with:
   - **Shift+Alt+F** (Windows/Linux)
   - **Shift+Option+F** (macOS)
   - Or right-click → **Format Document**

## Configuration

Configure formatting in VS Code settings:

```json
{
  "logi.formatting.indentSize": 2,
  "logi.formatting.alignColons": true,
  "logi.formatting.blankLinesBetweenBlocks": true
}
```

### Settings

- `logi.formatting.indentSize`: Number of spaces for indentation (default: 2)
- `logi.formatting.alignColons`: Align colons in token definitions (default: true)
- `logi.formatting.blankLinesBetweenBlocks`: Add blank lines between top-level blocks (default: true)

## Examples

### Logi Example

```logi
module orders

type order
  id: text
  user: user
  total: decimal
  status: order_status
  created_at: datetime
end

type order_status = pending | paid | processing | shipped | delivered

behavior place_order for user, cart
  check user is logged in
  check cart is not empty, otherwise fail with empty_cart
  step calculate total from cart items
  step create the order with status pending
  return the order
end

screen order_list for user
  bind orders from load_orders for user
  
  each order in orders
    show order_row for order
  end
end
```

### LogiDesign Example

```logidesign
tokens
  color
    primary:    #6366F1
    surface:    #FFFFFF
    text:       #1E293B
  end
  
  font
    md:  15
    lg:  18
  end
  
  space
    sm:  8
    md:  16
  end
end

style order_row
  layout:  row
  padding: sm md
  gap:     sm
  
  .price
    font:  md, bold
    color: primary
  end
  
  hover
    background: surface
  end
end
```

## Language Reference

### Logi Keywords (19)

`module`, `type`, `extends`, `failure`, `behavior`, `rule`, `step`, `check`, `when`, `otherwise`, `each`, `repeat`, `until`, `return`, `end`, `screen`, `widget`, `bind`, `show`

### LogiDesign Keywords

`tokens`, `style`, `theme`, `end`, `color`, `font`, `space`, `radius`, `shadow`, `size`, `hover`, `active`, `focus`, `disabled`, `selected`, `loading`, `error`, `on mobile`, `on tablet`, `on desktop`

## About Logi

**Logi** is a logic-first intent language where you describe *what* your software does. An LLM translates it into real programming languages and frameworks.

**LogiDesign** is the companion design language for describing visual styling with design tokens and platform-agnostic properties.

## Development

To build and test locally:

```bash
npm install
npm run compile
# Press F5 in VS Code to run Extension Development Host
```

To package:

```bash
npm run package
```

## License

MIT

## Links

- [Logi Language Specification](../../specs/logi.md)
- [LogiDesign Specification](../../specs/logidesign.md)
