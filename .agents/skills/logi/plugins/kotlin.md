# Logi Plugin — Kotlin

## Type Mappings

| Logi type  | Kotlin type       |
|------------|-------------------|
| `text`     | `String`          |
| `text?`    | `String?`         |
| `number`   | `Long` / `Int`    |
| `boolean`  | `Boolean`         |
| `datetime` | `Instant`         |
| `list<T>`  | `List<T>`         |
| `list<T>?` | `List<T>?`        |
| `void`     | `Unit` (omit return type in practice) |

## Construct Rules

### `type` → Kotlin `data class`
- Fields with `?` → nullable Kotlin type
- `= <default>` → default value in primary constructor
- No `@entity` annotation → plain `data class`
- With `@entity` + `@table("…")` → JPA `@Entity @Table(name="…") data class`; constructor params become `@Column` vars where annotated

### `component` → Kotlin `class` (service/repository/converter)
- One `usecase` inside → one `fun` / `override fun` inside the class
- `@endpoint(method, path)` on a usecase → `@GetMapping`/`@PostMapping`/etc. on the method
- `@requires_auth` → method-level Spring Security annotation or guard at top of function body

### `usecase` (standalone) → Kotlin top-level `fun` or extension function
- `for <params>` → function parameters
- `returns <type>` → `: <KotlinType>` return signature
- `returns void` → omit return type (Unit)

### `failure` → Kotlin `data class` extending a base error/exception
- Fields map to constructor parameters

### `check <cond>, otherwise fail with <F> with <fields>`
```kotlin
require(<cond>) { "<message>" }
// or
if (!<cond>) throw <FailureException>(<fields>)
```

### `when <cond> … end` / `otherwise … end`
```kotlin
if (<cond>) {
  …
} else {
  …
}
```

### `each <item> in <collection> … end`
```kotlin
for (<item> in <collection>) { … }
// or .forEach { … }
```

### `repeat until <cond> … end`
```kotlin
while (!<cond>) { … }
```

## Naming Conventions
- `snake_case` Logi names → `camelCase` Kotlin identifiers
- `snake_case` Logi type names → `PascalCase` Kotlin class names
- File name = `PascalCase` class name + `.kt`

## Annotations (Logi → Kotlin/JPA/Spring)
| Logi annotation | Kotlin annotation |
|---|---|
| `@entity` | `@Entity` |
| `@table("x")` | `@Table(name = "x")` |
| `@id` | `@Id @GeneratedValue(strategy = GenerationType.IDENTITY)` |
| `@unique` | `@Column(unique = true)` |
| `@column("x")` | `@Column(name = "x")` |
| `@generated` | `@GeneratedValue` |
| `@default("x")` | `@ColumnDefault("x")` / default value in constructor |
| `@relation(many_to_one, T)` | `@ManyToOne` |
| `@relation(one_to_many, T)` | `@OneToMany` |
| `@converter` | `@Converter` on the class |
| `@endpoint(method:"get", path:"/x")` | `@GetMapping("/x")` |
| `@endpoint(method:"post", path:"/x")` | `@PostMapping("/x")` |
| `@endpoint(method:"put", path:"/x")` | `@PutMapping("/x")` |
| `@endpoint(method:"delete", path:"/x")` | `@DeleteMapping("/x")` |
| `@requires_auth` | Guard call or `@PreAuthorize` |
| `@public` | No auth annotation |
