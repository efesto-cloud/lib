# @efesto-cloud/observable

A minimal observable value container — holds state, lets consumers read it, and notifies subscribers when it changes.

Use `Observable` when you need current value + updates. Use [`@efesto-cloud/publisher`](../publisher) for fire-and-forget events without stored state.

## Installation

```bash
pnpm add @efesto-cloud/observable @efesto-cloud/publisher
```

## Quick Start

```ts
import { Observable } from "@efesto-cloud/observable";

const count = new Observable(0);

const off = count.subscribe((value) => {
    console.log("count changed:", value);
});

count.set(1); // logs: count changed: 1
count.get();  // 1

off();
count.dispose(); // removes all subscribers
```

## API

```ts
interface IObservable<T> {
    get(): T;
    set(value: T): void;
    subscribe(callback: (value: T) => void): Unsubscribe;
    dispose(): void;
}
```

- `new Observable(initialState)` — seeded with a starting value.
- `get()` — current value.
- `set(value)` — replace the value and notify subscribers.
- `subscribe(cb)` — returns an `Unsubscribe` function.
- `dispose()` — unsubscribe every listener.

## Rules

- If you only need events (no stored value), use `Publisher` instead.
- Always call the returned unsubscribe function, or `dispose()` when tearing down the owning object.
- `set(value)` always notifies — even if the new value is identical to the previous one. If you need deduped updates, layer `Computed` or check before calling `set`.

## Example: shared state between components

```ts
const theme = new Observable<"light" | "dark">("light");

// Component A
const off = theme.subscribe((t) => applyTheme(t));

// Component B
theme.set("dark");

// On unmount
off();
```

## Related

- [`@efesto-cloud/publisher`](../publisher) — pub/sub without state.
- [`@efesto-cloud/compute`](../computed) — derive a value from one or more observables.
