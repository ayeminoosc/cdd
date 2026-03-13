# Logi Translation Rules

## Target Stack
<!-- e.g. TypeScript 5, React 18, Vite, TailwindCSS -->

## File Organization
<!--
Describe what files to generate per Logi construct, e.g.:
- type / failure  → src/generated/types/<Name>.ts
- usecase         → src/generated/usecases/<Name>.ts
- widget / screen → src/generated/components/<Name>.tsx
- flow            → src/generated/router/index.ts
-->

## Coding Conventions
<!--
- Naming: PascalCase for components, camelCase for functions/vars
- File naming: match declaration name exactly
- Imports: use @/ path aliases
- Always use async/await, never raw Promises
-->

## Per-Construct Rules
<!--
type       → TypeScript interface (readonly fields, no class)
failure    → TypeScript class extending Error with typed fields
usecase    → async function exported from a service module; validate inputs first
widget     → React functional component accepting Props interface; use Tailwind for styling
screen     → React page component registered in the router
flow       → React Router v6 routes object
job        → async function invoked by a scheduler/queue
-->

## Patterns & Examples
<!--
Paste representative existing code here so the LLM matches the project's style.
The more examples, the more consistent the output.
-->

## Do-Not List
<!--
- Do not use class components
- Do not use any (use unknown and narrow)
- Do not import from relative paths outside src/
- Do not generate CSS modules — use Tailwind only
-->
