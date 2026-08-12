# `Observable<T>`

Stateful reactive value. From `@efesto-cloud/observable`. Stores a
current value and notifies subscribers on change. For stateless event
broadcasting use `Publisher` (see `publisher.md`).

## The interface

```ts
type Unsubscribe = () => void;

interface IObservable<T> {
    get(): T;
    set(value: T): void;
    subscribe(callback: (value: T) => void): Unsubscribe;
    dispose(): void;
}
```

## Basic usage

```ts
import { Observable } from "@efesto-cloud/observable";

const count = new Observable(0);

const off = count.subscribe((v) => {
    console.log("count is", v);
});

count.set(1);     // logs "count is 1"
count.set(2);     // logs "count is 2"

console.log(count.get());  // 2

off();
count.set(3);     // does not log; subscriber gone

count.dispose();  // tears down the observable
```

`subscribe(...)` calls the callback synchronously every time `set(...)`
is invoked. Late subscribers see the current value via `get()` but
don't see past `set` calls (the observable doesn't replay history).

## When to use

- **Application state shared across modules** — e.g. "is the side
  panel open?", "current locale".
- **Bridging non-reactive sources to reactive UIs** — wrap a
  WebSocket connection state in an `Observable` so React components
  can subscribe.
- **Bidirectional UI state** — `<Input value={obs.get()}
  onChange={obs.set} />` style usage.

If you only need notifications without a stored value, use
`Publisher`. If you need a list of past values, neither — store the
list explicitly.

## Equality / change detection

The observable notifies on every `set(...)`, even if the new value is
the same as the old one. For change-only behaviour, guard at the call
site:

```ts
if (obs.get() !== nextValue) obs.set(nextValue);
```

Or for objects, compare relevant fields. There's no built-in
equality predicate.

## Disposal

`dispose()` unsubscribes everyone and signals the observable's death.
Use when the observable's lifetime is bounded (component unmount,
service shutdown, test teardown).

```ts
useEffect(() => {
    const obs = new Observable(initial);
    // ... wire it up ...
    return () => obs.dispose();
}, []);
```

## React integration

A typical pattern:

```ts
function useObservable<T>(obs: Observable<T>): T {
    const [v, setV] = useState(obs.get());
    useEffect(() => {
        const off = obs.subscribe(setV);
        return off;
    }, [obs]);
    return v;
}

// Usage:
function Counter() {
    const count = useObservable(globalCount);
    return <div>{count}</div>;
}
```

The hook keeps React's render cycle in sync with the observable's
value. `useSyncExternalStore` is the React 18+ native way to wire
this; either works.

## Typed shapes

Observables work on any type:

```ts
const profile = new Observable<{ name: string; age: number }>({
    name: "",
    age: 0,
});

profile.subscribe((p) => console.log(p.name));
profile.set({ name: "Alice", age: 30 });
```

For deeply structured state, prefer a single observable wrapping the
whole object over many small ones — it's easier to reason about and
React only re-renders once per update.

## Derived state with `Computed`

For read-only state derived from one or more `Observable`s, use
`Computed` from `@efesto-cloud/computed`. It recomputes (and notifies
subscribers) whenever any dependency changes, but only when the new
value differs (`!==`) from the previous one:

```ts
import { Observable } from "@efesto-cloud/observable";
import { Computed } from "@efesto-cloud/computed";

const first = new Observable("Ada");
const last = new Observable("Lovelace");

// dependencies tuple + a compute fn over their current values
const full = new Computed([first, last], ([f, l]) => `${f} ${l}`);

full.subscribe((v) => console.log(v));
first.set("Grace");        // logs "Grace Lovelace"
full.get();                // "Grace Lovelace"

full.dispose();            // unsubscribes everyone AND detaches from first/last
```

`IComputed<T>` extends `IObservable<T>` with no extra members, so a
`Computed` is read anywhere an `Observable` is accepted. Its `set()`
exists only to satisfy the interface and is a no-op — never call it.

## Anti-patterns

- **Using `Observable` as if it stores history.** It only stores the
  current value; past values are gone after the next `set`.
- **Calling `.set()` on a `Computed`.** It's a no-op; the value only
  changes when a dependency does.
- **Forgetting to `dispose()` a `Computed`.** It stays subscribed to
  its dependencies until disposed.
- **Forgetting to unsubscribe / dispose.** Same leak pattern as
  `Publisher`.
- **`obs.set(obs.get() + 1)` from two places concurrently.** Read-
  modify-write isn't atomic; if you have concurrent writers, hoist
  the mutation into a single function with a guarded path.

## Status in `task-planning`

Like `Publisher`, `Observable` isn't currently used in `task-planning`
(state lives in React's `useState` and React Router's loader
data). This reference is here for completeness — if the app grows a
piece of cross-component state that doesn't fit the route-loader
pattern (e.g. a persistent UI control), `Observable` is the
canonical answer.

## Quick reference

```ts
// Construct
const obs = new Observable<number>(0);

// Read
obs.get();

// Write (notifies subscribers)
obs.set(1);

// Subscribe
const off = obs.subscribe((v) => { /* ... */ });

// Cleanup
off();         // unsubscribe one
obs.dispose(); // tear down the observable
```
