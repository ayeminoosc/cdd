# LogiDesign v2 — The Visual Design Language for Logi v2

**LogiDesign v2** is the companion design language to Logi v2.
It describes how your UI looks — color, typography, spacing, layout, states, variants, motion, and theme behavior.

Logi v2 (`.logi`) describes what the software is and what it does.
LogiDesign v2 (`.logidesign`) describes how the interface should look and feel.

File extension: `.logidesign`

---

## Design Philosophy

LogiDesign v2 is platform-agnostic.
You write one design language and the LLM translates it to CSS, Tailwind, SwiftUI modifiers, Compose parameters, Flutter decoration, or desktop UI styling.

The design language should express visual intent clearly without forcing authors to write platform-specific styles.

You define:
- design tokens
- widget styles
- variants
- motion
- themes
- responsive behavior
- accessibility and adaptation rules
- semantic UI roles and page composition roles

The translator decides:
- CSS properties and variables
- utility classes or component styles
- animation APIs
- native platform styling details
- platform-specific layout primitives

---

## Design Rules

1. All **keywords are lowercase**
2. Token names use **snake_case**
3. Widget style names must match a `widget` defined in `.logi`
4. Raw visual values are allowed in `tokens`, but styles should prefer token references
5. Child roles must match the `as` qualifiers used in `.logi` `show` statements
6. Motion and responsive behavior should be described semantically rather than with platform APIs
7. Layout should use a universal flex-style model by default so it can map to web, mobile, and desktop UI systems

---

## File Structure

A `.logidesign` file contains five block types:

```text
tokens   — define the design system foundation
style    — define visual rules for a widget
variant  — define a named variant for a widget
theme    — override tokens for a theme
motion   — define reusable motion behavior
```

Typical file layout:

```text
app.logidesign         — global tokens, themes, and motion
auth.logidesign        — widget styles for auth flows
commerce.logidesign    — widget styles for commerce flows
```

LogiDesign v2 works together with Logi v2.

Typical linkage points from `.logi` are:
- `show login_form with variant compact`
- `@theme("dark")` on a screen or flow
- `@motion("standard")` on a widget or screen
- `@variant("primary")` on a widget declaration when a default variant is desired

---

## Keywords

LogiDesign v2 uses these keywords.

```text
tokens
style
variant
theme
motion
end
hover
active
focus
disabled
selected
loading
error
on mobile
on tablet
on desktop
```

---

## `tokens`

Defines named values used across the design system.
There should usually be one main `tokens` block for the application.

```text
tokens
  <category>
    <name>: <value>
    ...
  end
  ...
end
```

### Token categories

| Category | Purpose |
|---|---|
| `color` | Color palette and semantic colors |
| `font` | Font families and type scale |
| `space` | Spacing scale |
| `radius` | Corner radius scale |
| `shadow` | Shadow scale |
| `size` | Fixed dimension values |
| `border` | Border widths or styles |
| `motion` | Duration and easing tokens |

### Example

```text
tokens
  color
    primary:        #2563EB
    primary_hover:  #1D4ED8
    danger:         #DC2626
    success:        #16A34A
    surface:        #FFFFFF
    background:     #F8FAFC
    text:           #0F172A
    muted:          #64748B
    border:         #CBD5E1
    overlay:        rgba(15, 23, 42, 0.55)
  end

  font
    body:   "Inter"
    display:"Sora"
    mono:   "JetBrains Mono"
    xs:     12
    sm:     14
    md:     16
    lg:     20
    xl:     28
    2xl:    40
  end

  space
    xs:   4
    sm:   8
    md:   16
    lg:   24
    xl:   32
    2xl:  48
  end

  radius
    sm:   4
    md:   10
    lg:   18
    full: 9999
  end

  shadow
    sm: subtle drop shadow
    md: medium drop shadow
    lg: deep floating shadow
  end

  size
    icon_sm:   16
    icon_md:   24
    icon_lg:   32
    content_md: 720
    content_lg: 1200
  end

  motion
    quick: 120ms
    normal: 220ms
    slow: 360ms
    smooth: ease-out
    snappy: ease-in-out
  end
end
```

### Semantic token recommendation

To reduce visual drift across LLMs, prefer semantic token roles over purely generic color names.

Recommended semantic color roles:
- `page_background`
- `panel_surface`
- `panel_surface_elevated`
- `text_primary`
- `text_muted`
- `text_error`
- `field_background`
- `field_border`
- `field_border_error`
- `action_primary_background`
- `action_primary_text`
- `focus_ring`

Recommended semantic size and spacing roles:
- `form_width`
- `field_height`
- `button_height`
- `section_gap`
- `field_gap`

---

## `style`

Defines the base visual appearance of a widget.

```text
style <widget_name>
  <property>: <value>
  ...
end
```

The widget name must match a `widget` in a `.logi` file.

### Layout properties

LogiDesign v2 uses a universal flex-style layout model by default.
This maps well to CSS flexbox, SwiftUI stacks, Compose rows and columns, Flutter rows and columns, and desktop layout containers.

Use `grid` only when you need explicit multi-column placement.
Use `stack` only when items visually overlap.

| Property | Values | Description |
|---|---|---|
| `layout` | `flex`, `grid`, `stack` | Primary layout model |
| `direction` | `row`, `column` | Main axis direction for `flex` |
| `justify` | `start`, `center`, `end`, `space-between`, `space-around`, `space-evenly` | Main axis distribution |
| `align` | `start`, `center`, `end`, `stretch` | Cross axis alignment |
| `gap` | `<space token>` | Space between children |
| `padding` | `<token>` or `<v-token> <h-token>` | Inner spacing |
| `columns` | `<number>` | Number of columns in a grid |
| `wrap` | `yes`, `no` | Child wrapping behavior |
| `grow` | `<number>` | Growth factor inside parent flex layout |
| `shrink` | `<number>` | Shrink factor inside parent flex layout |
| `basis` | `auto`, `fit`, `<size token>` | Preferred size in flex layout |

### Visual properties

| Property | Values | Description |
|---|---|---|
| `background` | `<color token>` | Background color |
| `color` | `<color token>` | Foreground color |
| `font` | `<size token>, <weight>` | Font size and weight |
| `font_family` | `<font token>` | Specific font family |
| `border` | `<width> <color token>` | Border width and color |
| `border_bottom` | `<width> <color token>` | Bottom border |
| `border_top` | `<width> <color token>` | Top border |
| `radius` | `<radius token>` | Corner rounding |
| `shadow` | `<shadow token>` | Shadow |
| `opacity` | `<0-100%>` | Transparency |
| `overflow` | `hidden`, `scroll`, `visible` | Overflow behavior |
| `transition` | `<motion token>` | Transition duration or preset token |
| `motion` | `<motion name>` | Reusable motion behavior |

### Size properties

| Property | Values | Description |
|---|---|---|
| `width` | `<size token>`, `full`, `auto`, `fit` | Width |
| `height` | `<size token>`, `full`, `auto`, `fit` | Height |
| `min_width` | `<size token>` | Minimum width |
| `max_width` | `<size token>` | Maximum width |
| `min_height` | `<size token>` | Minimum height |
| `max_height` | `<size token>` | Maximum height |
| `aspect` | `16x9`, `4x3`, `1x1` | Aspect ratio |

### Image properties

| Property | Values | Description |
|---|---|---|
| `fit` | `cover`, `contain`, `fill` | Image sizing behavior |

### Font weights

```text
thin, light, regular, medium, semibold, bold, extrabold
```

---

## Child Roles

Target the named role assigned via `as` in a `show` statement.
Prefix with `.` inside a `style` or `variant` block.

```text
show a login button as submit_button     →   .submit_button
show error_message as form_error         →   .form_error
show product.name as title               →   .title
```

Child roles may use all visual, layout, size, and state properties.

---

## App Integration

LogiDesign v2 does not choose variants or themes by itself.
Selection comes from Logi v2.

### Variant selection

Use either of these in `.logi`:

```text
show login_form with variant compact
```

or:

```text
@variant("compact")
widget login_form
  ...
end
```

When both exist, the `show ... with variant ...` form is more specific and wins for that usage.

When `@render("strict")` is active in Logi v2, translators should not invent new variants or decorative treatments beyond the selected style and variant.

### Theme selection

Use a screen, flow, or application-level annotation:

```text
@theme("dark")
screen login_screen
  ...
end
```

Built-in theme behavior:
- `dark` follows system dark mode unless explicitly overridden
- `a11y` follows accessibility preferences or can be forced
- `compact` and `large` are explicit product choices unless mapped by the translator to platform density settings

Theme resolution order:
1. explicit screen or flow annotation
2. explicit application setting
3. system preference when the theme is adaptive, such as `dark` or `a11y`

### Motion selection

Use a widget or screen annotation when a motion preset should apply by default:

```text
@motion("standard")
widget login_form
  ...
end
```

---

## State Blocks

Override properties for widget states.

```text
hover
  ...
end

active
  ...
end

focus
  ...
end

disabled
  ...
end

selected
  ...
end

loading
  ...
end

error
  ...
end
```

State blocks support all normal properties plus:

| Property | Values | Description |
|---|---|---|
| `scale` | `<0.0-2.0>` | Scale transform |
| `cursor` | `pointer`, `default`, `not-allowed`, `text` | Pointer behavior |
| `translate` | `<description>` | Positional movement hint |

---

## Responsive Blocks

Override properties for screen sizes.

```text
on mobile
  ...
end

on tablet
  ...
end

on desktop
  ...
end
```

Responsive blocks support all normal properties.

Default responsive semantics:
- `on mobile` means compact phone-sized layouts
- `on tablet` means medium-width layouts or tablet size classes
- `on desktop` means large-width layouts or desktop windows

Recommended translation defaults:
- mobile: under 640px or compact width class
- tablet: 640px to 1024px or medium width class
- desktop: above 1024px or expanded width class

Translators may adapt these ranges for native platforms, but should preserve the author's intent.

---

## `variant`

Defines a named alternative style for a widget.
Variants are used when a widget has multiple visual forms such as primary, danger, compact, or inline.

```text
variant <widget_name> <variant_name>
  <property>: <value>
  ...
end
```

Example:

```text
variant button primary
  background: primary
  color: surface
end

variant button danger
  background: danger
  color: surface
end
```

Variants may include child roles, state blocks, and responsive blocks.

Variants should override only what changes from the base `style`.

---

## `motion`

Defines reusable motion behavior.

```text
motion <name>
  enter: <description>
  exit: <description>
  emphasis: <description>
  duration: <motion token>
  easing: <motion token>
end
```

Example:

```text
motion standard
  enter: soft fade and rise
  exit: soft fade out
  emphasis: quick scale down on press
  duration: normal
  easing: smooth
end
```

Motion may be applied by a translator automatically or referenced from styles.

When the user prefers reduced motion, translators should simplify or remove non-essential motion while preserving clarity and feedback.

In `@render("strict")` mode, translators should prefer the exact named motion preset and avoid adding extra motion not described by the source.

---

## `theme`

Overrides token values for a named theme.
Themes should only redefine values that change from the base tokens.

```text
theme <name>
  <category>
    <name>: <value>
    ...
  end
  ...
end
```

### Built-in theme names

```text
dark        — dark mode
a11y        — high readability and larger targets
compact     — denser spacing
large       — larger typography and spacing
```

Custom theme names are also valid.

Example:

```text
theme dark
  color
    surface:    #0F172A
    background: #020617
    text:       #E2E8F0
    muted:      #94A3B8
    border:     #334155
  end
end

theme a11y
  font
    md: 18
    lg: 24
    xl: 32
  end

  space
    sm: 12
    md: 20
    lg: 32
  end
end
```

---

## Accessibility And Adaptation

LogiDesign v2 should support accessible visual systems by default.

Translators should preserve these expectations:
- interactive controls keep visible focus styling
- destructive and error states are distinguishable without color alone when possible
- touch targets remain reasonably sized on mobile and tablet
- reduced motion settings suppress non-essential animation
- large or `a11y` themes increase readability and spacing instead of only scaling text

The design language does not replace semantic accessibility in Logi v2, but it should reinforce it visually.

---

## Deterministic Design Mapping

To reduce variance between LLMs, translators should apply design in this order:

1. base widget `style`
2. selected `variant`
3. selected `theme`
4. state block overrides
5. responsive block overrides

When two rules conflict, the more specific rule wins.

Specificity order:
1. child role inside responsive or state block
2. child role block
3. state block
4. responsive block
5. variant
6. base style

---

## Page Composition Roles

Large UI differences often come from page structure, not colors.
LogiDesign v2 therefore recognizes common page composition roles that translators should honor when present in Logi v2.

Recommended roles:
- `page_shell`
- `hero_region`
- `form_region`
- `supporting_region`
- `footer_region`
- `dialog_surface`
- `sheet_surface`

These should usually be styled with the same discipline as widgets so that screen-level composition becomes more deterministic.

---

## App Shell And Layers

Large applications need consistent shell and overlay styling.

Use normal widget styles for app shell pieces such as:
- top bars
- side navigation
- bottom bars
- dialogs
- sheets
- toasts
- empty states

Use `layout: stack` when visual layers overlap, such as dialogs over screens or floating actions over content.

Use `layout: grid` only when explicit rows and columns are visually important.

---

## Full Example

```text
tokens
  color
    primary:        #2563EB
    primary_hover:  #1D4ED8
    danger:         #DC2626
    surface:        #FFFFFF
    background:     #F8FAFC
    text:           #0F172A
    muted:          #64748B
    border:         #CBD5E1
  end

  font
    body: "Inter"
    sm:   14
    md:   16
    lg:   20
    xl:   28
  end

  space
    xs: 4
    sm: 8
    md: 16
    lg: 24
  end

  radius
    sm: 4
    md: 10
    lg: 18
    full: 9999
  end

  shadow
    sm: subtle drop shadow
    md: medium drop shadow
  end

  size
    content_md: 720
  end

  motion
    quick: 120ms
    normal: 220ms
    smooth: ease-out
  end
end

motion standard
  enter: soft fade and rise
  exit: soft fade out
  emphasis: quick scale down on press
  duration: normal
  easing: smooth
end

style login_form
  layout: flex
  direction: column
  gap: md
  padding: lg
  background: surface
  radius: lg
  shadow: sm
  max_width: content_md

  .user_name_field
    border: 1 border
    radius: md
    padding: sm md
  end

  .password_field
    border: 1 border
    radius: md
    padding: sm md
  end

  .form_error
    color: danger
    font: sm, medium
  end

  .submit_button
    background: primary
    color: surface
    padding: sm md
    radius: md
    motion: standard
  end

  hover
    shadow: md
  end

  on mobile
    padding: md
  end
end

variant login_form compact
  padding: md
  gap: sm
end

theme dark
  color
    surface:    #0F172A
    background: #020617
    text:       #E2E8F0
    muted:      #94A3B8
    border:     #334155
  end
end
```

---

## Translation Model

LogiDesign v2 is not executed directly. It is translated by an LLM into platform-native styling.

```text
LogiDesign Source (.logidesign)
              ↓
         LLM Translation
              ↓
CSS / Tailwind / SwiftUI / Compose / Flutter / Desktop UI styling
```

### What each construct becomes

| LogiDesign v2 | Web | SwiftUI / Compose / Flutter | Desktop |
|---|---|---|---|
| `tokens` | CSS variables / theme objects | theme constants | theme constants |
| `style` | component style rules | view modifiers | widget styling rules |
| `variant` | modifier classes / variant props | enum or style variants | style variants |
| `motion` | transitions / keyframes | animation definitions | animation definitions |
| `theme` | theme overrides | theme overrides | theme overrides |

---

## What LogiDesign v2 Is Designed For

- app design systems
- widget styling
- theming
- motion and transitions
- responsive UI behavior
- accessible visual systems

## What LogiDesign v2 Is Not Designed For

- application logic
- backend behavior
- data fetching
- navigation logic
- test scenarios

---

## Summary

LogiDesign v2 gives the author one job: describe visual intent clearly.
The LLM handles the target styling system.

The key decisions in v2 are:
- keep tokens, styles, and themes
- add first-class variants
- add first-class motion
- use a universal flex-style layout model by default
- recommend semantic tokens and page composition roles for more deterministic rendering
- keep widget-role targeting via `as`
- stay platform-agnostic at the source level

LogiDesign v2 is the visual companion to Logi v2.
