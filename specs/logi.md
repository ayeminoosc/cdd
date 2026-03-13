# Logi v2 — A Structured Intent Language for Software

**Logi v2** is a structured, human-readable language for describing complete software systems.
It is designed for people with basic programming knowledge who understand high-level concepts like types, use cases, screens, and events, but do not want to write full implementation code.

Logi v2 is powered by LLMs. You describe the structure, logic, UI, flow, and behavior of a system.
The LLM translates it into real programming languages, frameworks, services, UI code, tests, and design assets.

File extension: `.logi`

---

## Design Philosophy

Most programming languages force you to describe both intent and implementation.
Logi v2 focuses on intent and structure.

You define:
- **Types** — the data in your system
- **Failures** — the ways things can go wrong
- **Usecases** — the business operations the system can perform
- **Widgets** — reusable UI pieces
- **Screens** — top-level user interfaces
- **State** — values a screen owns and updates
- **Events** — things that happen in the UI or system
- **Actions** — executable calls to usecases
- **Flows** — navigation between screens
- **Annotations** — metadata for persistence, endpoints, validation, auth, testing, and translator hints

The LLM decides:
- programming language and framework
- API transport and endpoint structure
- database schema and ORM
- async execution model
- state management implementation
- routing library and navigation primitives
- UI framework details
- test framework and automation code

You should not need to write framework code, HTML, JSX, hooks, controllers, reducers, routing setup, or test framework syntax.

---

## Why Not HTML Or JSX As Source

HTML and JSX are valid output targets for the web, but they should not be the source language.

Reasons:
- HTML is web-specific and does not describe mobile or desktop UI well
- HTML describes structure, not application logic, actions, or navigation
- JSX is tied to JavaScript or TypeScript and assumes programming syntax
- templating syntax quickly becomes full code again

Logi v2 stays platform-agnostic at the authoring level.
The translator may generate HTML, JSX, SwiftUI, Compose, Flutter, Java, Spring, Node, or other targets as needed.

---

## Language Rules

1. All **keywords are lowercase**
2. Type, usecase, widget, and screen names use **snake_case**
3. Field names use **snake_case**
4. Free-form natural language is allowed in `step`, `show`, `check`, and `when`
5. `#` starts a comment — ignored by the translator
6. Indentation is for readability — not enforced
7. Types are recommended on usecase inputs, fields, props, and state
8. `usecase` is the main keyword for executable business logic
9. `event` is separate from `usecase` — an event signals that something happened, while a usecase performs work
10. Annotations start with `@` and attach metadata to the next declaration or field
11. Inline references inside natural-language clauses use `{qualified.name}` syntax

---

## Keywords

Logi v2 has these core keywords.

```text
module
type
extends
failure
usecase
for
returns
check
when
otherwise
each
repeat
until
return
end
screen
state
prop
event
action
call
with
show
step
flow
route
on
set
run
go
back
job
system_event
```

These are the current intended building blocks for the application DSL.
`component` is a reserved architectural term, but not currently part of the formal app DSL syntax.

---

## Type System

### Built-in types

```text
text          any string value
number        whole number
decimal       precise decimal
boolean       true or false
date          calendar date
datetime      date and time
void          no return value
```

### Modifiers

```text
T[]           array of T
T?            optional T
```

### Field syntax

```text
field_name
field_name: type
field_name: type?
field_name: type[]
field_name: type = default
field_name: type? = null
```

### Usecase syntax

Logi v2 uses a business-oriented usecase signature.

```text
usecase name for arg1: type, arg2: type returns return_type
```

Examples:

```text
usecase login for user_name: text, password: text returns session
usecase load_orders for user_id: text returns order[]
usecase logout for session_id: text returns void
```

Usecases are invoked with readable call syntax:

```text
call login with user_name, password
call load_orders with current_user.id
```

### Annotation syntax

Annotations attach optional metadata to the next declaration.

```text
@name
@name("value")
@name(key: value)
@name(key: value, key: value)
```

Examples:

```text
@entity
@table("users")
@endpoint(method: "post", path: "/login")
@requires_auth
@test_id("login_form")
```

Use keywords for core structure.
Use annotations for optional metadata and translation hints.

### Inline Reference Syntax

Logi v2 allows explicit symbol references inside natural-language clauses.

Canonical syntax:

```text
{qualified_name}
```

Examples:

```text
{email}
{current_user.email}
{submit_login.error.message}
{validation_failed.message}
```

Use inline references in line-based clauses such as `check`, `when`, `step`, `show`, and natural-text `on` effects when a sentence needs to point to a specific value.

Examples:

```text
check {email} is not empty, otherwise fail with validation_failed
check {email} matches email format, otherwise fail with validation_failed
when {submit_login.error} exists
  show error text with content {submit_login.error.message}
end
step send reset link to {current_user.email}
```

Why this form is canonical:

- it creates clear boundaries inside English text
- it is easier to tokenize than `$name` inside prose
- it avoids ambiguity about where a reference ends
- it stays distinct from annotations, keywords, and normal words

`$name` is not part of the canonical syntax.

For structured expressions outside natural-language text, keep using normal qualified names without braces.

Examples:

```text
call login with email, password
on submit_login.failed -> set error_message = submit_login.error.message
```

---

## Grammar Reference

---

### `module`

Groups related definitions.

```text
module <name>
  ...
end
```

---

### `type`

Defines a record type or enum.

**Record type:**

```text
type <name>
  <field>
  ...
end
```

**Record type with inheritance:**

```text
type <name> extends <parent>
  <field>
  ...
end
```

**Enum type:**

```text
type <name> = <variant> | <variant> | ...
```

Example:

```text
@entity
@table("users")
type user
  @id
  id: text

  name: text

  @unique
  email: text

  created_at: datetime
end

type session
  token: text
  user_id: text
end

type user_status = active | suspended | pending
```

Common type and field annotations include:

- `@entity`
- `@table("...")`
- `@id`
- `@unique`
- `@index`
- `@relation(kind: "one_to_many", target: "...")`
- `@generated`
- `@default("...")`

---

### `failure`

Defines a named failure case.

```text
failure <name>
  <field>
  ...
end
```

Examples:

```text
failure validation_failed
  field: text?
  message: text
end

failure auth_failed
  message: text
end
```

---

### `usecase`

Defines a business or system operation.

`usecase` is the main executable logic primitive in Logi v2.
It is intentionally business-oriented so the DSL stays closer to software intent than to general programming syntax.

```text
usecase <name> for <inputs> returns <return_type>
  ...
end
```

The body may contain: `check`, `when`, `each`, `repeat`, `step`, and `return`.

Example:

```text
@endpoint(method: "post", path: "/login")
@public
usecase login for user_name: text, password: text returns session
  check user_name is not empty, otherwise fail with validation_failed
  check password is not empty, otherwise fail with validation_failed
  step authenticate the user credentials
  return the session
end
```

Generated output may become a function, method, endpoint handler, service call, command handler, or other implementation form depending on the target stack.

Common usecase annotations include:

- `@endpoint(method: "get" | "post" | "put" | "delete", path: "...")`
- `@public`
- `@requires_auth`
- `@role("...")`
- `@idempotent`
- `@job_handler`
- `@description("...")`

---

### `component`

`component` is a generic architectural term in Logi v2, not a UI keyword.
It may be used in future extensions for reusable non-UI building blocks such as service components, integration components, or system modules.

For UI, Logi v2 uses `widget`.

---

### `check`

A guard clause.
If the condition is false, the usecase stops immediately.

```text
check <condition>
check <condition>, otherwise fail with <failure>
```

Examples:

```text
check user_name is not empty, otherwise fail with validation_failed
check password is not empty, otherwise fail with validation_failed
check current_user exists, otherwise fail with unauthorized
check {email} matches email format, otherwise fail with validation_failed
```

---

### `when` / `otherwise`

Conditional branching.

```text
when <condition>
  ...
end

when <condition>
  ...
end
otherwise
  ...
end
```

Example:

```text
when current_user is an admin
  step show the admin dashboard
end
otherwise
  step show the regular dashboard
end

when {submit_login.error} exists
  step announce {submit_login.error.message}
end
```

---

### `each`

Iterates over a collection.

```text
each <item> in <collection>
  ...
end
```

---

### `repeat` / `until`

Defines a loop.

```text
repeat until <condition>
  ...
end
```

---

### `return`

Defines the output of a usecase.

```text
return <value>
return failure <failure>
return failure <failure> with <detail>
```

---

### `widget`

Defines a reusable UI widget.

Widgets receive props, emit events, and describe UI using `show`.

```text
widget <name>
  ...
end
```

The body may contain: `prop`, `event`, `show`, `when`, and `each`.

Example:

```text
@test_id("login_form")
widget login_form
  prop user_name: text
  prop password: text
  prop error_message: text?
  prop is_loading: boolean

  event user_name_changed(value: text)
  event password_changed(value: text)
  event submit_clicked()

  show a text input labeled "User name" as user_name_field
  show a password input labeled "Password" as password_field

  when error_message exists
    show error_message below password_field as form_error
  end

  when {error_message} exists
    show helper text with content {error_message}
  end

  show a login button as submit_button
end
```

Common widget annotations include:

- `@test_id("...")`
- `@render("strict" | "expressive" | "system_native")`
- `@variant("...")`
- `@motion("...")`
- `@platform("web" | "mobile" | "desktop")`

---

### `screen`

Defines a top-level UI screen.

Screens own local state, define actions, display widgets, and wire events.

```text
screen <name>
  ...
end
```

The body may contain: `state`, `event`, `action`, `show`, `when`, `each`, and `on`.

Example:

```text
@route("/login")
screen login_screen
  state user_name: text
  state password: text
  state error_message: text?
  state is_loading: boolean = false

  action submit_login -> call login with user_name, password

  show login_form

  on login_form.user_name_changed -> set user_name
  on login_form.password_changed -> set password
  on login_form.submit_clicked -> run submit_login
  on submit_login.started -> set is_loading = true
  on submit_login.failed -> set is_loading = false
  on submit_login.failed -> set error_message = submit_login.error.message
  on submit_login.succeeded -> go to home_screen
end
```

Common screen annotations include:

- `@route("...")`
- `@requires_auth`
- `@theme("...")`
- `@title("...")`
- `@layout("...")`

---

### `state`

Defines mutable values owned by a screen.

```text
state <name>: <type>
state <name>: <type> = <default>
```

Examples:

```text
state user_name: text
state is_loading: boolean = false
state error_message: text?
```

---

### `prop`

Defines a value passed into a widget.

```text
prop <name>: <type>
```

---

### `event`

Defines something that can happen.

Events are not usecases.
An event signals occurrence. A usecase performs work.

```text
event <name>()
event <name>(<inputs>)
```

Examples:

```text
event submit_clicked()
event user_name_changed(value: text)
event item_selected(id: text)
```

---

### `action`

Defines a named executable call to a usecase.

An action can be run by events and has observable lifecycle states such as `started`, `failed`, and `succeeded`.

```text
action <name> -> call <usecase_name> with <value>, <value>
```

Examples:

```text
action submit_login -> call login with user_name, password
action load_order -> call get_order with order_id
```

Actions may use annotations for transport, retry, or caching hints when needed.

---

### `show`

Declares what the user sees.

```text
show <plain English description>
```

Examples:

```text
show a text input labeled "User name"
show a password input labeled "Password"
show a login button
show an error message below password_field
show login_form
show login_form with user_name, password, error_message, is_loading
show login_form with variant compact
```

When showing a widget, Logi v2 may pass values into widget props.

```text
show <widget_name>
show <widget_name> with <value>, <value>, <value>
show <widget_name> with <prop_name>: <value>, <prop_name>: <value>
show <widget_name> with variant <variant_name>
show <widget_name> with <prop_name>: <value> and variant <variant_name>
```

If positional values are used, they map to widget props in declaration order.
Named values are preferred when readability matters.

When showing a widget, Logi v2 may optionally select a design variant.

```text
show <widget_name>
show <widget_name> with variant <variant_name>
```

Theme selection is usually applied at the screen or flow level with annotations such as `@theme("dark")`.
Motion selection is usually applied with annotations such as `@motion("standard")`.

---

## Deterministic UI Rendering

Plain-English `show` remains valid, but it is intentionally flexible.
When consistent UI generation matters across different LLMs, prefer canonical UI primitives and strict render annotations.

### Render strictness

Use `@render(...)` to control how much visual freedom the translator has.

```text
@render("strict")
widget login_form
  ...
end
```

Allowed render modes:

- `strict` — generate only explicitly described structure and design mappings
- `expressive` — allow tasteful embellishment consistent with the design system
- `system_native` — prefer platform-native controls and conventions

In `strict` mode, translators should not add extra decorative elements, secondary layouts, icons, or visual treatments that are not implied by the source.

### Canonical UI primitives

For deterministic rendering, Logi v2 supports a preferred structured `show` form for common UI elements.

```text
show text <role> label "..."
show badge <role> label "..."
show input <role> label "..."
show password_input <role> label "..."
show button <role> label "..."
show helper_text <role> label "..."
show error_text <role> label "..."
show spinner <role>
show widget <widget_name>
show widget <widget_name> with ...
```

Examples:

```text
show text title label "Welcome back"
show input email_field label "Email address"
show password_input password_field label "Password"
show error_text email_error_text label validation_message
show button submit_button label "Continue"
show spinner submit_spinner
```

These forms are preferred when you want multiple LLMs to converge on similar UI.

### Page composition

For screens, the author should prefer explicit layout intent through annotations and named roles.

Recommended screen-level layout annotations:

- `@layout("centered_form")`
- `@layout("split_panel")`
- `@layout("dashboard_shell")`
- `@layout("stacked_content")`

Recommended screen-level region roles:

- `hero_region`
- `form_region`
- `supporting_region`
- `footer_region`

This reduces model variance in page composition.

### Form rendering rules

When using canonical form primitives, translators should preserve these defaults unless the source overrides them:

- field errors render inline with their field
- error text appears after the related field in reading order
- loading indicators do not remove the primary action
- loading state may disable the submit action
- helper text is visually distinct from error text
- validation feedback uses semantic error styling from LogiDesign tokens

---

### `on`

Defines explicit UI or action wiring.

```text
on <source> -> <effect>
```

Examples:

```text
on login_form.user_name_changed -> set user_name
on login_form.submit_clicked -> run submit_login
on submit_login.succeeded -> go to home_screen
on submit_login.failed -> set error_message = submit_login.error.message
```

This is intentionally explicit so the translator does not need to guess app wiring.

---

### `flow`

Defines navigation rules.

```text
flow <name>
  start: <screen>
  route <source> -> <destination>
  ...
end
```

Example:

```text
flow auth_flow
  start: login_screen
  route login_screen.success -> home_screen
  route login_screen.forgot_password -> reset_password_screen
end
```

---

### `job`

Defines background work.

```text
job <name>(<inputs>)
  ...
end
```

Example:

```text
job send_welcome_email(user: user)
  step send a welcome email to the user
end
```

---

### `system_event`

Defines a system-level event.

```text
system_event <name>(<inputs>)
```

Example:

```text
system_event order_created(order: order)
```

---

## Complete Example

### Login Flow

```text
module auth

@entity
@table("sessions")
type session
  @id
  token: text
  user_id: text
end

failure validation_failed
  field: text?
  message: text
end

failure auth_failed
  message: text
end

@endpoint(method: "post", path: "/login")
@public
usecase login for user_name: text, password: text returns session
  check user_name is not empty, otherwise fail with validation_failed
  check password is not empty, otherwise fail with validation_failed
  step authenticate the user credentials
  return the session
end

@test_id("login_form")
widget login_form
  prop user_name: text
  prop password: text
  prop error_message: text?
  prop is_loading: boolean

  event user_name_changed(value: text)
  event password_changed(value: text)
  event submit_clicked()

  show a text input labeled "User name" as user_name_field
  show a password input labeled "Password" as password_field

  when error_message exists
    show error_message below password_field as form_error
  end

  when is_loading
    show a loading indicator inside submit_button
  end

  show a login button as submit_button
end

@route("/login")
screen login_screen
  state user_name: text
  state password: text
  state error_message: text?
  state is_loading: boolean = false

  action submit_login -> call login with user_name, password

  show login_form with user_name, password, error_message, is_loading

  on login_form.user_name_changed -> set user_name
  on login_form.password_changed -> set password
  on login_form.submit_clicked -> run submit_login
  on submit_login.started -> set is_loading = true
  on submit_login.failed -> set is_loading = false
  on submit_login.failed -> set error_message = submit_login.error.message
  on submit_login.succeeded -> go to home_screen
end

flow auth_flow
  start: login_screen
end

end
```

---

## Translation Model

Logi v2 is not executed directly. It is translated by an LLM into real code.

```text
Logi Source (.logi)
        ↓
   LLM Translation
        ↓
Backend + Web + Mobile + Desktop + Tests
```

### What each construct becomes

| Logi v2 | Backend | Web | Mobile / Desktop |
|---|---|---|---|
| `type` | class / schema / DTO | interface / type | data class / model |
| `failure` | error class / exception | error type | error model |
| `usecase` | service method / handler | mutation / query wrapper | ViewModel or controller operation |
| `widget` | — | reusable UI component | reusable view component |
| `screen` | — | page / route component | screen / view |
| `state` | session or controller state | local component or page state | view state |
| `prop` | — | component props | view input parameters |
| `event` | domain or UI signal | callback / event | callback / event |
| `action` | application command | async UI action / mutation | async UI action |
| `flow` | route policy | router config | navigation graph |
| `job` | worker / scheduled job | background task trigger | background sync task |
| `system_event` | message / event bus event | subscription source | subscription source |
| `@annotation` | metadata for schema, auth, endpoints, testing, and translation hints | metadata attributes | metadata attributes |

---

## What Logi v2 Is Designed For

- backend services and APIs
- SaaS business logic
- forms and dashboards
- mobile app flows
- desktop business applications
- web application features
- authentication and authorization
- business workflows and automation
- LLM-assisted full-stack generation

## What Logi v2 Is Not Designed For

- operating systems
- compilers and interpreters
- graphics engines
- GPU and shader programming
- low-level embedded systems
- heavily optimized algorithmic code as primary source

---

## Summary

Logi v2 is not trying to replace programming languages.
It is trying to describe software clearly enough that LLMs can generate programming languages reliably.

The key decisions in v2 are:

- use `usecase` as the main business operation keyword
- use `widget` for UI and keep `component` as a generic architectural term
- keep explicit structure for state, events, actions, and flow
- use annotations for persistence, endpoints, validation, auth, and translator hints
- add render strictness and canonical UI primitives for more deterministic UI generation
- keep readable intent for `check`, `when`, `step`, and `show`
- avoid using HTML or JSX as the source language
- support backend, UI, navigation, and system behavior in one app DSL

Logi v2 gives the author one job: describe the software clearly.
The LLM does the rest.
