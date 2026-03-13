# Logi Plugin — Spring Framework

> Loaded in addition to the language plugin (e.g. `kotlin.md` or `java.md`) when `framework` is `spring`.

## Component → Spring `@Service` / `@RestController`

- A `component` with `@endpoint(…)` usecases → generate **two** classes:
  - `@RestController` with the HTTP handler methods
  - `@Service` with the business logic
  - Controller delegates to Service
- A `component` without endpoint annotations → `@Service` only
- Inject dependencies via constructor injection (`@RequiredArgsConstructor` or explicit constructor)

## Dependency Injection
- All collaborators injected through the primary constructor, not field injection
- No `@Autowired` on fields

## JPA Entities
- Companion to `@entity` `type`:
  - Add `@Entity @Table(name = "…")` on the class
  - Primary key field gets `@Id @GeneratedValue(strategy = GenerationType.IDENTITY)`
  - Add a no-arg constructor (or use `@NoArgsConstructor` if Lombok available)
- `@relation(many_to_one, T)` → `@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "…_id")`
- `@relation(one_to_many, T)` → `@OneToMany(mappedBy = "…", cascade = [CascadeType.ALL])`

## Spring Web
- Response wrapping: return `ResponseEntity<T>` from controller methods
- `returns void` usecase in controller → `ResponseEntity<Void>` with status `204 No Content`
- Path variables `{id}` → `@PathVariable val id: String`
- Request body → `@RequestBody val request: RequestType`
- Query params → `@RequestParam(required = false) val x: String? = null`

## Transaction
- Service methods that modify state → `@Transactional`
- Read-only service methods → `@Transactional(readOnly = true)`

## Exception Handling
- `failure` types → extend a base `AppException` or `BusinessException`
- Add a `@RestControllerAdvice` if one doesn't exist; map each `failure` type to an HTTP status

## Package Structure (with `module` declaration)
```
module com.example.auth   →  package com.example.auth
```
- Controller file: `<ModuleName>Controller.kt`
- Service file: `<ModuleName>Service.kt`
- Entity file: `<TypeName>.kt` (same package as module or `model` sub-package per project convention)
