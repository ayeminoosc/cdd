# LogiDesign v2 Grammar — Minimal EBNF

This document defines a minimal parser-oriented grammar for LogiDesign v2.
It is designed to be strict about structural blocks and property syntax while leaving semantic interpretation to translators.

---

## Scope

This grammar covers:
- tokens
- styles
- variants
- motion
- themes
- child role blocks
- state blocks
- responsive blocks

It does not attempt to validate token names or widget names against `.logi` files. That is a semantic validation step.

---

## Lexical Conventions

```ebnf
letter              = "A".."Z" | "a".."z" ;
digit               = "0".."9" ;
underscore          = "_" ;
newline             = "\n" | "\r\n" ;
space               = " " | "\t" ;
spaces              = { space } ;

identifier          = ( "a".."z" ) , { "a".."z" | digit | underscore } ;

string_char         = ? any character except quote and newline ? ;
string_literal      = '"' , { string_char } , '"' ;
integer_literal     = digit , { digit } ;
percent_literal     = integer_literal , "%" ;

comment             = "#" , { ? any character except newline ? } ;
line_text           = ? all characters until newline ? ;
value_text          = line_text ;
```

Notes:
- property values are intentionally parsed as line text in most cases
- this keeps the grammar stable while leaving translators room to interpret token references and semantic phrases

---

## Top Level

```ebnf
document            = { design_decl } ;

design_decl         = tokens_decl
                    | style_decl
                    | variant_decl
                    | motion_decl
                    | theme_decl ;
```

---

## Tokens

```ebnf
tokens_decl         = "tokens" , newline ,
                      { token_category_decl } ,
                      "end" , newline ;

token_category_decl = token_category_name , newline ,
                      { token_entry } ,
                      "end" , newline ;

token_category_name = "color"
                    | "font"
                    | "space"
                    | "radius"
                    | "shadow"
                    | "size"
                    | "border"
                    | "motion" ;

token_entry         = identifier , ":" , spaces , value_text , newline ;
```

---

## Styles

```ebnf
style_decl          = "style" , spaces , identifier , newline ,
                      { style_item } ,
                      "end" , newline ;

style_item          = property_decl
                    | child_role_block
                    | state_block
                    | responsive_block ;
```

---

## Variants

```ebnf
variant_decl        = "variant" , spaces , identifier , spaces , identifier , newline ,
                      { style_item } ,
                      "end" , newline ;
```

The two identifiers are:
- widget name
- variant name

---

## Motion

```ebnf
motion_decl         = "motion" , spaces , identifier , newline ,
                      { motion_property_decl } ,
                      "end" , newline ;

motion_property_decl = motion_property_name , ":" , spaces , value_text , newline ;

motion_property_name = "enter"
                     | "exit"
                     | "emphasis"
                     | "duration"
                     | "easing" ;
```

---

## Themes

```ebnf
theme_decl          = "theme" , spaces , identifier , newline ,
                      { token_category_decl } ,
                      "end" , newline ;
```

---

## Properties And Nested Blocks

```ebnf
property_decl       = property_name , ":" , spaces , value_text , newline ;

child_role_block    = "." , identifier , newline ,
                      { property_decl | state_block | responsive_block } ,
                      "end" , newline ;

state_block         = state_name , newline ,
                      { property_decl } ,
                      "end" , newline ;

responsive_block    = responsive_name , newline ,
                      { property_decl | child_role_block | state_block } ,
                      "end" , newline ;

state_name          = "hover"
                    | "active"
                    | "focus"
                    | "disabled"
                    | "selected"
                    | "loading"
                    | "error" ;

responsive_name     = "on mobile"
                    | "on tablet"
                    | "on desktop" ;
```

---

## Property Names

The grammar accepts any lowercase identifier as a property name, but the current v2 spec recognizes these primary properties:

```ebnf
property_name       = identifier | multiword_property_name ;

multiword_property_name = "font_family"
                        | "border_bottom"
                        | "border_top"
                        | "min_width"
                        | "max_width"
                        | "min_height"
                        | "max_height" ;
```

Common property names include:
- `layout`
- `direction`
- `justify`
- `align`
- `gap`
- `padding`
- `columns`
- `wrap`
- `grow`
- `shrink`
- `basis`
- `background`
- `color`
- `font`
- `font_family`
- `border`
- `border_bottom`
- `border_top`
- `radius`
- `shadow`
- `opacity`
- `overflow`
- `transition`
- `motion`
- `width`
- `height`
- `min_width`
- `max_width`
- `min_height`
- `max_height`
- `aspect`
- `fit`
- `scale`
- `cursor`
- `translate`

---

## Parser Assumptions

1. `end` closes the nearest open block.
2. Indentation is ignored for syntax.
3. Property values are parsed as raw text, not deeply typed expressions.
4. Token references, motion references, and semantic phrases such as `subtle drop shadow` are resolved later by semantic analysis.
5. `on mobile`, `on tablet`, and `on desktop` are treated as single responsive keywords at parse time.
6. Child role names must begin with `.`.
7. `variant` names are not validated against `@variant(...)` usage during parsing.
8. Comments are stripped before syntactic analysis.

---

## Recommended Parser Strategy

Use a block parser with line-based property capture:

1. Parse top-level blocks strictly.
2. Parse nested blocks strictly.
3. Store property values as raw text.
4. Perform semantic validation after parsing.

That keeps LogiDesign v2 easy to evolve without destabilizing the parser.