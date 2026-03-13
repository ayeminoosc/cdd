# Logi Plugin — Java

## Type Mappings

| Logi type  | Java type         |
|------------|-------------------|
| `text`     | `String`          |
| `text?`    | `String` (nullable, use `@Nullable`) |
| `number`   | `Long` / `Integer` |
| `boolean`  | `boolean` / `Boolean` |
| `datetime` | `Instant` or `LocalDateTime` |
| `list<T>`  | `List<T>`         |
| `list<T>?` | `@Nullable List<T>` |
| `void`     | `void`            |

## Construct Rules

### `type` → Java `record` (Java 16+) or POJO
- Fields with `?` → `@Nullable` annotation on the parameter
- `= <default>` → not directly expressible in records; use a static factory or builder
- With `@entity` → `@Entity @Table(name="…") public class …` (JPA requires mutable class, not record)

### `component` → Java `class`
- One `usecase` inside → one method inside the class
- Constructor injection via `final` fields + all-args constructor (or Lombok `@RequiredArgsConstructor`)

### `usecase` (standalone) → Java `static` method or method in a service

### `failure` → Java `class` extending `RuntimeException`

## Naming Conventions
- `snake_case` Logi names → `camelCase` Java identifiers
- `snake_case` Logi type names → `PascalCase` Java class names
- File name = `PascalCase` class name + `.java`

## Annotations
Same annotation mapping as the `kotlin.md` plugin, with slight differences:
- `@Converter` on class (JPA `AttributeConverter`)
- Field annotations use `@Column`, `@Id`, `@GeneratedValue`, etc. directly on the field (not constructor param)
