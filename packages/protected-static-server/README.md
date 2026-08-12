# @efesto-cloud/react-observable

React hooks that subscribe to an [`Observable`](../observable) and re-render on change.

Use these when a React component needs to read the current value of an `Observable` and update when it changes. For raw subscriptions outside React, use [`@efesto-cloud/observable`](../observable) directly.

## Installation

```bash
pnpm add @efesto-cloud/react-observable @efesto-cloud/observable react
```

## Quick Start

```tsx
import { Observable } from "@efesto-cloud/observable";
import useObservable from "@efesto-cloud/react-observable";

const count = new Observable(0);

function Counter() {
    const value = useObservable(count);
    return <button onClick={() => count.set(value + 1)}>{value}</button>;
}
```

## API

### `useObservable<T>(observable)`

Generic hook — returns the current value of any `IObservable<T>` and re-renders on change.

```ts
function useObservable<T>(observable: IObservable<T>): T;
```

```tsx
const theme = new Observable<"light" | "dark">("light");

function ThemeBadge() {
    const current = useObservable(theme);
    return <span>{current}</span>;
}
```

### `useBooleanObservable(observable)`

Specialization for `IObservable<boolean>`. Same contract as `useObservable`, but typed to `boolean`.

```ts
function useBooleanObservable(observable: IObservable<boolean>): boolean;
```

### `useStringObservable(observable, onChange?)`

Binds an `IObservable<string>` to a text input. Returns a `[value, handleChange]` tuple wired for `<input onChange={...} />`.

```ts
function useStringObservable(
    observable: IObservable<string>,
    onChange?: (value: string) => void,
): readonly [string, (e: React.ChangeEvent<HTMLInputElement>) => void];
```

```tsx
const name = new Observable("");

function NameField() {
    const [value, onChange] = useStringObservable(name, (v) => name.set(v));
    return <input value={value} onChange={onChange} />;
}
```

### `useIntegerObservable(observable, onChange?)`

Binds an `IObservable<number>` to a text input, keeping the raw string locally so the user can type intermediate states (empty, `-`, etc.). `onChange` fires only when the input parses to a valid integer.

```ts
function useIntegerObservable(
    observable: IObservable<number>,
    onChange?: (value: number) => void,
): readonly [string, (e: React.ChangeEvent<HTMLInputElement>) => void];
```

```tsx
const age = new Observable(0);

function AgeField() {
    const [value, onChange] = useIntegerObservable(age, (v) => age.set(v));
    return <input value={value} onChange={onChange} />;
}
```

## Rules

- The hooks subscribe on mount and unsubscribe on unmount — don't call `observable.subscribe` yourself in the same component.
- Swapping the `observable` identity between renders resyncs to the new observable's current value.
- `useStringObservable` / `useIntegerObservable` do not call `set` on the observable themselves — pass an `onChange` that calls `observable.set` if that's what you want. This keeps the hook usable with read-only or derived observables.
- `useIntegerObservable` returns the raw input string, not a number. It only invokes `onChange` when the string parses to a valid integer.

## Related

- [`@efesto-cloud/observable`](../observable) — the underlying value container.
- [`@efesto-cloud/computed`](../computed) — derive a value from one or more observables.
- [`@efesto-cloud/publisher`](../publisher) — pub/sub without stored state.
