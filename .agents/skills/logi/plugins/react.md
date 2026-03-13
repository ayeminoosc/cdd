# Logi Plugin — React Framework

> Loaded in addition to `typescript.md` when `framework` is `react`.

## Widget → React Functional Component

```tsx
interface <WidgetName>Props {
  // props from `prop` declarations
  // callbacks from `event` declarations → onEventName: (params) => void
}

export function <WidgetName>({ …props }: <WidgetName>Props) {
  return (
    // rendered JSX
  );
}
```

- Always a named export (not default) unless project convention says otherwise
- Use `React.FC` only if the project already uses it; prefer plain function signature
- Props interface lives in the same file unless the project separates types

## Screen → React Page Component

```tsx
export default function <ScreenName>Page() {
  // useState hooks for each `state` declaration
  // handler functions for each `action` declaration
  return (
    // JSX using widget components
  );
}
```

- `state` → `useState` hook — type and initial value must match Logi declaration exactly
- `action` → `const handle<ActionName> = async () => { … }`
- `on <widget>.<event>` → pass `handle<ActionName>` or inline arrow to the widget's prop

## Styling
- Use Tailwind CSS utility classes
- No inline styles unless unavoidable
- No CSS modules

## Hooks
- Side effects (`step call api`, `step fetch`) → inside `useEffect` or in an action handler
- Loading/error state → explicit `state is_loading: boolean = false` and `state error: text? = null` in Logi

## File Organization
- Widgets → `src/components/<WidgetName>.tsx`
- Screens → `src/pages/<ScreenName>.tsx` (or `src/screens/`)
- Shared types → `src/types/<TypeName>.ts`
- Services/usecases → `src/services/<ServiceName>.ts`

## Routing (when `framework` is `react`)
- `flow` → React Router v6 `RouteObject[]`
- `@route("x")` on a screen → path in route config
