# Logi v2 Grammar — Minimal EBNF

This document defines a minimal parser-oriented grammar for Logi v2.
It is intentionally practical rather than fully formal.

The main rule is:
- structural syntax is parsed strictly
- natural-language clauses such as `check`, `when`, `show`, and `step` are parsed as text payloads

This matches the intent of Logi v2: explicit structure with flexible human-readable logic descriptions.

---

## Scope

This grammar covers:
- modules
- annotations
- types and failures
- usecases
- widgets and screens
- state, props, events, actions
- show and on wiring
- flows
- jobs and system events

It does not attempt to fully parse the internal English text of:
- `check`
- `when`
- `show`
- `step`

Those are treated as structured text fields.
Parsers should still recognize `{qualified_name}` spans inside those text fields as explicit symbol references.

---

## Lexical Conventions

```ebnf
letter              = "A".."Z" | "a".."z" ;
digit               = "0".."9" ;
underscore          = "_" ;
hyphen              = "-" ;
newline             = "\n" | "\r\n" ;
space               = " " | "\t" ;
spaces              = { space } ;

identifier          = lowercase_identifier ;
lowercase_identifier = ( "a".."z" ) , { "a".."z" | digit | underscore } ;

string_char         = ? any character except quote and newline ? ;
string_literal      = '"' , { string_char } , '"' ;

integer_literal     = digit , { digit } ;
boolean_literal     = "true" | "false" ;
null_literal        = "null" ;

comment             = "#" , { ? any character except newline ? } ;
qualified_name      = identifier , { "." , identifier } ;
type_name           = identifier ;
variant_name        = identifier ;

line_text           = ? all characters until newline ? ;
natural_text        = line_text ;
reference_text      = "{" , qualified_name , "}" ;
```

Notes:
- identifiers are currently snake_case by convention
- comments are ignored by the parser
- indentation is not significant
- block structure is defined by keywords and `end`
- inline references inside natural-text clauses use `{qualified_name}`

---

## Top Level

```ebnf
document            = { top_level_decl } ;

top_level_decl      = annotated_decl ;

annotated_decl      = { annotation } , declaration ;

declaration         = module_decl
                    | type_decl
                    | failure_decl
                    | usecase_decl
                    | widget_decl
                    | screen_decl
                    | flow_decl
                    | job_decl
                    | system_event_decl ;
```

---

## Annotations

```ebnf
annotation          = "@" , identifier , [ annotation_args ] , newline ;

annotation_args     = "(" , [ annotation_arg , { "," , annotation_arg } ] , ")" ;

annotation_arg      = named_annotation_arg | literal_value ;
named_annotation_arg = identifier , ":" , literal_value ;

literal_value       = string_literal
                    | integer_literal
                    | boolean_literal
                    | null_literal
                    | identifier ;
```

Examples:
- `@entity`
- `@table("users")`
- `@endpoint(method: "post", path: "/login")`

---

## Modules

```ebnf
module_decl         = "module" , spaces , identifier , newline ,
                      { module_member } ,
                      "end" , newline ;

module_member       = annotated_decl ;
```

---

## Types And Failures

```ebnf
type_decl           = record_type_decl | enum_type_decl ;

record_type_decl    = "type" , spaces , identifier , [ spaces , "extends" , spaces , type_name ] , newline ,
                      { annotated_field_decl } ,
                      "end" , newline ;

enum_type_decl      = "type" , spaces , identifier , spaces , "=" , spaces , variant_name ,
                      { spaces , "|" , spaces , variant_name } , newline ;

failure_decl        = "failure" , spaces , identifier , newline ,
                      { annotated_field_decl } ,
                      "end" , newline ;

annotated_field_decl = { annotation } , field_decl ;

field_decl          = identifier , [ spaces , ":" , spaces , type_ref ] , [ spaces , "=" , spaces , default_value ] , newline ;

type_ref            = type_name , [ "[]" | "?" ]
                    | type_name , "[]"
                    | type_name , "?" ;

default_value       = literal_value ;
```

---

## Usecases

```ebnf
usecase_decl        = "usecase" , spaces , identifier , [ spaces , "for" , spaces , param_list ] , [ spaces , "returns" , spaces , type_ref ] , newline ,
                      { usecase_stmt } ,
                      "end" , newline ;

param_list          = param_decl , { "," , spaces , param_decl } ;
param_decl          = identifier , [ spaces , ":" , spaces , type_ref ] ;

usecase_stmt        = check_stmt
                    | when_stmt
                    | each_stmt
                    | repeat_stmt
                    | step_stmt
                    | return_stmt ;

check_stmt          = "check" , spaces , natural_text , newline ;
step_stmt           = "step" , spaces , natural_text , newline ;

return_stmt         = "return" , spaces , natural_text , newline ;
```

Notes:
- `check ... otherwise fail with ...` is parsed as one `natural_text` payload
- `return failure ...` is also parsed as `natural_text`

---

## Conditionals And Iteration

```ebnf
when_stmt           = "when" , spaces , natural_text , newline ,
                      { block_stmt } ,
                      [ "otherwise" , newline , { block_stmt } ] ,
                      "end" , newline ;

each_stmt           = "each" , spaces , identifier , spaces , "in" , spaces , natural_text , newline ,
                      { block_stmt } ,
                      "end" , newline ;

repeat_stmt         = "repeat" , spaces , "until" , spaces , natural_text , newline ,
                      { block_stmt } ,
                      "end" , newline ;

block_stmt          = check_stmt
                    | when_stmt
                    | each_stmt
                    | repeat_stmt
                    | step_stmt
                    | return_stmt
                    | show_stmt
                    | on_stmt ;
```

---

## Widgets

```ebnf
widget_decl         = "widget" , spaces , identifier , newline ,
                      { widget_stmt } ,
                      "end" , newline ;

widget_stmt         = prop_decl
                    | event_decl
                    | show_stmt
                    | when_stmt
                    | each_stmt ;

prop_decl           = "prop" , spaces , identifier , [ spaces , ":" , spaces , type_ref ] , newline ;

event_decl          = "event" , spaces , identifier , "(" , [ param_list ] , ")" , newline ;
```

---

## Screens

```ebnf
screen_decl         = "screen" , spaces , identifier , newline ,
                      { screen_stmt } ,
                      "end" , newline ;

screen_stmt         = state_decl
                    | event_decl
                    | action_decl
                    | show_stmt
                    | when_stmt
                    | each_stmt
                    | on_stmt ;

state_decl          = "state" , spaces , identifier , [ spaces , ":" , spaces , type_ref ] , [ spaces , "=" , spaces , default_value ] , newline ;

action_decl         = "action" , spaces , identifier , spaces , "->" , spaces , usecase_call , newline ;

usecase_call        = "call" , spaces , identifier , [ spaces , "with" , spaces , arg_list ] ;
```

---

## Show Syntax

```ebnf
show_stmt           = "show" , spaces , show_target , newline ;

show_target         = widget_show
                    | natural_text ;

widget_show         = identifier , [ spaces , "with" , spaces , widget_show_args ] ;

widget_show_args    = variant_only
                    | widget_prop_args
                    | widget_prop_args , spaces , "and" , spaces , variant_only ;

variant_only        = "variant" , spaces , identifier ;

widget_prop_args    = named_widget_args | positional_widget_args ;

named_widget_args   = named_widget_arg , { "," , spaces , named_widget_arg } ;
named_widget_arg    = identifier , ":" , spaces , expr ;

positional_widget_args = expr , { "," , spaces , expr } ;
```

Parser rule:
- if `show` contains a single identifier, parse as widget show syntax
- if `show` starts with an identifier and is followed by `with`, parse as widget show syntax
- otherwise parse the rest of the line as natural text

---

## Wiring And Effects

```ebnf
on_stmt             = "on" , spaces , event_source , spaces , "->" , spaces , effect_expr , newline ;

event_source        = qualified_name ;

effect_expr         = set_effect
                    | run_effect
                    | go_effect
                    | back_effect
                    | natural_text ;

set_effect          = "set" , spaces , identifier , spaces , "=" , spaces , expr
                    | "set" , spaces , identifier ;

run_effect          = "run" , spaces , identifier
                    | "run" , spaces , usecase_call ;

go_effect           = "go" , spaces , "to" , spaces , identifier ;
back_effect         = "back" ;
```

---

## Flows

```ebnf
flow_decl           = "flow" , spaces , identifier , newline ,
                      flow_start_decl ,
                      { route_decl } ,
                      "end" , newline ;

flow_start_decl     = "start:" , spaces , identifier , newline ;

route_decl          = "route" , spaces , qualified_name , spaces , "->" , spaces , route_target , newline ;
route_target        = identifier | "back" ;
```

---

## Jobs And System Events

```ebnf
job_decl            = "job" , spaces , identifier , "(" , [ param_list ] , ")" , newline ,
                      { usecase_stmt } ,
                      "end" , newline ;

system_event_decl   = "system_event" , spaces , identifier , "(" , [ param_list ] , ")" , newline ;
```

---

## Expressions

Logi v2 intentionally keeps expressions minimal in the grammar.

```ebnf
expr                = qualified_name
                    | literal_value ;

arg_list            = expr , { "," , spaces , expr } ;
```

Notes:
- this grammar does not define arithmetic, boolean operators, or full expression precedence
- those can be added later if the language needs them
- inline references are only for natural-text payloads; structured expressions continue to use bare qualified names

---

## Inline References In Natural Text

Natural-text clauses may embed explicit symbol references.

```ebnf
natural_text_with_refs = { natural_chunk | inline_reference } ;

natural_chunk      = ? any character sequence that does not start an inline reference ? ;
inline_reference   = "{" , qualified_name , "}" ;
```

Examples:
- `check {email} is not empty, otherwise fail with validation_failed`
- `when {submit_login.error} exists`
- `show helper text with content {submit_login.error.message}`

Parser guidance:
1. Preserve the original raw text exactly.
2. Optionally extract `inline_reference` spans for semantic tooling, validation, and editor support.
3. Do not treat `$name` as a reference token.

---

## Parser Assumptions

1. `end` closes the nearest open block.
2. Indentation is ignored for syntax, but may be used by formatters and editors.
3. `check`, `when`, `step`, and most `show` clauses are line-based natural text.
4. A parser should preserve the raw text payload for those clauses exactly.
5. Within natural-text payloads, `{qualified_name}` is the canonical inline reference syntax.
6. `show` lines are ambiguous by design; parsers should first try widget-show syntax, then fall back to natural text.
7. `on ... -> ...` supports a small structured effect language first, then falls back to natural text.
8. Annotations belong to the next declaration or field only.
9. Comments are stripped before syntactic analysis.
10. Reserved words should not be accepted as identifiers.
11. `component` is reserved but not part of the current formal grammar.
12. `returns` belongs to usecase declarations, while `return` belongs to usecase bodies.

---

## Recommended Parser Strategy

Use a two-layer parser:

1. A strict structural parser for blocks, declarations, signatures, annotations, wiring, and simple expressions.
2. A text-capturing layer for natural-language clauses.

This keeps Logi v2 parseable without forcing the language to become a full programming language.