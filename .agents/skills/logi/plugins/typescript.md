# Logi Plugin — TypeScript

## Type Mappings

| Logi type  | TypeScript type   |
|------------|-------------------|
| `text`     | `string`          |
| `text?`    | `string \| null` or `string \| undefined` (follow project style) |
| `number`   | `number`          |
| `boolean`  | `boolean`         |
| `datetime` | `Date` or `string` (ISO 8601, follow project style) |
| `list<T>`  | `T[]`             |
| `list<T>?` | `T[] \| null`     |
| `void`     | `void`            |

## Construct Rules

### `type` → TypeScript `interface` (default) or `type` alias
- Fields with `?` → optional field (`field?: Type`) or nullable (`field: Type | null`)
- `= <default>` → only relevant in class-based implementations; for plain interfaces, omit defaults or move them to factory functions
- No `@entity` → plain `interface` or `type`

### `component` → TypeScript `class`
- One `usecase` inside → one `async method()` inside the class
- Constructor-injected dependencies → constructor parameters with `private readonly` prefix
- Export the class

### `usecase` (standalone) → exported `async function`
- `for <params>` → function parameters with TypeScript types
- `returns <type>` → `: Promise<KotlinType>` (wrap in Promise if async)
- `returns void` → `: Promise<void>`

### `failure` → TypeScript `class` extending `Error`
```typescript
export class SomethingFailedError extends Error {
  constructor(public readonly field: string) {
    super('…message…');
    this.name = 'SomethingFailedError';
  }
}
```

### `widget` → React functional component
- `prop <name>: <type>` → field in `interface <WidgetName>Props`
- `event <name>(<params>)` → `on<Name>: (<params>) => void` prop
- Use Tailwind CSS for styling (no CSS modules unless project says otherwise)

### `screen` → React page component
- `state <name>: <type> = <default>` → `const [name, setName] = useState<Type>(default)`
- `action <name> -> call <usecase> with <args>` → `const handleName = async () => { … }`
- `on <widget>.<event> -> …` → pass the handler as a prop to the widget component
- Default export the component; register in the router separately

### `flow` → Route configuration (React Router v6)
```typescript
export const routes: RouteObject[] = […]
```

## Naming Conventions
- `snake_case` Logi names → `camelCase` TypeScript identifiers / function names
- `snake_case` Logi type names → `PascalCase` TypeScript class/interface names
- File name = `PascalCase` name + `.ts` (or `.tsx` for widgets/screens)

## Annotations (Logi → TypeScript decorators or JSDoc)
| Logi annotation | TypeScript equivalent |
|---|---|
| `@entity` | `@Entity()` (TypeORM) or `@ObjectType()` (GraphQL) |
| `@table("x")` | `@Entity("x")` (TypeORM) |
| `@id` | `@PrimaryGeneratedColumn()` or `@PrimaryColumn()` |
| `@unique` | `@Column({ unique: true })` |
| `@column("x")` | `@Column({ name: 'x' })` |
| `@endpoint(method, path)` | Express route or NestJS `@Get/@Post/…` |
| `@requires_auth` | Auth middleware / guard |
| `@test_id("x")` | `data-testid="x"` on the root element |
| `@route("x")` | Path in router config |
