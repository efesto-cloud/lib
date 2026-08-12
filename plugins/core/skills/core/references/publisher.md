# `Publisher<ARGS>`

Fire-and-forget event broadcasting. From `@efesto-cloud/publisher`.
For stateful reactive values, use `Observable` instead (see
`observer.md`).

The simplest reactive primitive: subscribers register a callback, the
publisher calls every subscriber when `notify(...)` is invoked. No
state is stored — late subscribers don't see past events.

## The interface

```ts
type Subscriber<ARGS extends unknown[]> = (...args: ARGS) => void;
type Unsubscribe = () => void;

interface IPublisher<ARGS extends unknown[]> {
    size: number;
    subscribe(s: Subscriber<ARGS>): Unsubscribe;
    unsubscribe(id: number): void;
    notify(...args: ARGS): void;
    unsubscribeAll(): void;
}
```

The generic parameter is a **tuple type** describing the arguments
`notify(...)` accepts and `subscribe`'s callback receives.

## Basic usage

```ts
import { Publisher } from "@efesto-cloud/publisher";

const bus = new Publisher<[string, number]>();

const off = bus.subscribe((event, code) => {
    console.log(event, code);
});

bus.notify("saved", 200);

off();                  // unsubscribe via the returned cleanup
// or:
bus.unsubscribeAll();
```

The tuple `[string, number]` means subscribers get
`(event: string, code: number)`. Single-argument publishers use
`Publisher<[string]>` — note the brackets; `Publisher<string>` is
wrong.

## When to use

- **Cross-component notifications** — one component publishes, others
  subscribe.
- **Domain events** — an entity wants to broadcast "this happened"
  without coupling to listeners.
- **Lifecycle hooks** — "before save", "after delete", etc.

If you need the current value (not just notifications about changes),
use `Observable`. If you need a strongly-typed event with a single
named payload, consider a normal event-emitter pattern with named
events instead.

## Unsubscription matters

`subscribe()` returns a cleanup function. Keep it and call it when
the subscriber goes away — typically in a component unmount, a service
shutdown, or a test teardown.

```ts
const off = bus.subscribe(handler);
// ... later ...
off();
```

Failing to unsubscribe leaks references to the subscriber and
prevents garbage collection of any context it captures.

When subscribing in a React effect:

```ts
useEffect(() => {
    const off = bus.subscribe(handler);
    return off;  // cleanup
}, []);
```

## Typed arguments

The tuple form lets each argument carry its own type:

```ts
type FooChange = { id: string; field: keyof FooDto; oldValue: unknown; newValue: unknown };

const fooChanges = new Publisher<[FooChange]>();

fooChanges.subscribe((change) => {
    console.log(`Foo ${change.id} changed ${change.field}`);
});

fooChanges.notify({ id: "abc", field: "name", oldValue: "Old", newValue: "New" });
```

For "no arguments" use `Publisher<[]>` — and since the generic
defaults to `[]`, a bare `new Publisher()` is equivalent:

```ts
const ping = new Publisher();   // same as Publisher<[]>
ping.subscribe(() => console.log("pinged"));
ping.notify();
```

## Anti-patterns

- **Using `Publisher` as a state container.** Subscribers don't get
  the last value. If you want "current value plus updates", use
  `Observable`.
- **Forgetting to unsubscribe.** Subscriptions are references; leaks
  manifest as growing `bus.size` or unintended event firings.
- **Mismatched arg tuple.** `notify("a", 1)` against
  `Publisher<[string]>` errors at compile time, which is the point.

## Status in `task-planning`

The `task-planning` codebase doesn't currently use `Publisher` — there
are no domain events to broadcast. This reference describes the
primitive so it's documented when (if) the codebase grows in that
direction. Likely first use: a "member created" or "pratica state
changed" event that the webapp's analytics layer subscribes to.

## Quick reference

```ts
// Construct
const pub = new Publisher<[string, number]>();

// Subscribe
const off = pub.subscribe((event, code) => { /* ... */ });

// Notify
pub.notify("saved", 200);

// Inspect
pub.size;  // number of active subscribers

// Cleanup
off();              // unsubscribe one
pub.unsubscribeAll();  // unsubscribe everyone
```
