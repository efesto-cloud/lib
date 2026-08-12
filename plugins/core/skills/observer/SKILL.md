---
name: observer
description: Use when writing or reviewing Observable code from the @efesto-cloud/observable package, or derived/read-only state from @efesto-cloud/computed.
argument-hint: "Paste code and ask: 'normalize Observable usage'"
---

# Observer

**Installation:** If not already installed, add the packages:
- `pnpm add @efesto-cloud/observable` (provides `Observable`; depends on `@efesto-cloud/publisher`)
- `pnpm add @efesto-cloud/publisher` (only if you use `Publisher` directly)
- `pnpm add @efesto-cloud/computed` (only if you need derived state)

Use this skill when you need reactive state, derived state, or pub/sub.

## Quick Rule
- `Observable`: hold state (`get`/`set`) and notify on change.
- `Computed`: derive read-only state from one or more `Observable` dependencies; recomputes (and notifies) when any dependency changes.
- `Publisher`: emit events (`notify`) without storing state.

## Procedure
1. If you need current value + updates, use `Observable`.
2. If a value is derived from other observables, use `Computed` (never `.set()` it manually).
3. If you need fire-and-forget events, use `Publisher`.
4. Always clean subscriptions: call the cleanup fn returned by `subscribe`, or `dispose()` to drop all subscribers at once. `Computed.dispose()` also detaches it from its dependencies.

## Common Mistakes
- Using `Publisher` as if it stores state.
- Calling `.set()` on a `Computed` — it is a no-op; the value only changes when a dependency does.
- Forgetting to unsubscribe (or to `dispose()` a `Computed`, which leaves it subscribed to its dependencies).

## Tiny Examples
```ts
const count = new Observable(0);
const off = count.subscribe((v) => console.log(v));
count.set(1);
off();
```

```ts
const bus = new Publisher<[string]>();
bus.subscribe((msg) => console.log(msg));
bus.notify("saved");
```

```ts
import { Computed } from "@efesto-cloud/computed";

const first = new Observable("Ada");
const last = new Observable("Lovelace");

// dependencies tuple + a compute fn over their values
const full = new Computed([first, last], ([f, l]) => `${f} ${l}`);
full.subscribe((v) => console.log(v)); // logs "Grace Lovelace" when first changes
first.set("Grace");

full.get(); // "Grace Lovelace"
full.dispose(); // detaches from `first`/`last`
```

The `IObservable` interface is defined as follows:

```ts
interface IObservable<T> {
    get(): T;
    set(value: T): void;
    subscribe(callback: (value: T) => void): Unsubscribe;
    dispose(): void;
}
```

`IComputed<T>` extends `IObservable<T>` with no extra members, so a `Computed` is read anywhere an `Observable` is accepted. Its constructor is `new Computed(dependencies, computeFn)`, where `dependencies` is a tuple of `IObservable`s and `computeFn` maps their current values to the derived value; `set()` exists only to satisfy the interface and does nothing.