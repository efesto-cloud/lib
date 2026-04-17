# @efesto-cloud/compute

A `Computed<T>` observable derived from one or more `Observable` dependencies. Re-evaluates (and notifies) only when the computed value actually changes.

> The package is named `@efesto-cloud/compute` but lives in `packages/computed`.

## Installation

```bash
pnpm add @efesto-cloud/compute @efesto-cloud/observable
```

## Quick Start

```ts
import { Observable } from "@efesto-cloud/observable";
import { Computed } from "@efesto-cloud/compute";

const firstName = new Observable("Ada");
const lastName  = new Observable("Lovelace");

const fullName = new Computed(
    [firstName, lastName],
    ([first, last]) => `${first} ${last}`,
);

const off = fullName.subscribe((name) => console.log(name));

firstName.set("Grace"); // logs: "Grace Lovelace"
lastName.set("Lovelace"); // no log — identical result, no notify

off();
fullName.dispose(); // unsubscribes from every dependency
```

## API

`Computed<T, DEPS>` implements `IObservable<T>`:

```ts
new Computed<T, DEPS>(
    dependencies: { [K in keyof DEPS]: IObservable<DEPS[K]> },
    computeFn: (values: DEPS) => T,
);

get(): T;
set(value: T): void;  // no-op — Computed is read-only
subscribe(cb: (value: T) => void): Unsubscribe;
dispose(): void;      // unsubscribe from deps and drop listeners
```

## Rules

- `Computed` is read-only: `set()` is a no-op.
- Subscribers fire only when `compute()` produces a value **not `===`** to the previous one. This is reference equality — return the same array/object reference if you want dedup to work.
- Always call `dispose()` when the owning object is torn down; otherwise the `Computed` keeps subscriptions to its dependencies alive.

## Example: derived from many sources

```ts
const a = new Observable(1);
const b = new Observable(2);
const c = new Observable(3);

const sum = new Computed([a, b, c], ([x, y, z]) => x + y + z);

sum.subscribe((v) => console.log("sum:", v));
b.set(20); // logs: sum: 24
```

## Related

- [`@efesto-cloud/observable`](../observable) — source of truth for values.
- [`@efesto-cloud/publisher`](../publisher) — events without stored state.
