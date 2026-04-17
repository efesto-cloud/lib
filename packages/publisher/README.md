# @efesto-cloud/publisher

Tiny, typed pub/sub primitive for broadcasting events **without stored state**.

Use `Publisher` for fire-and-forget events; use [`@efesto-cloud/observable`](../observable) when you also need to keep the current value.

## Installation

```bash
pnpm add @efesto-cloud/publisher
```

## Quick Start

```ts
import { Publisher } from "@efesto-cloud/publisher";

const bus = new Publisher<[string, number]>();

const off = bus.subscribe((event, code) => {
    console.log(event, code);
});

bus.notify("saved", 200);

off(); // unsubscribe
```

## API

```ts
interface IPublisher<ARGS extends unknown[]> {
    size: number;
    subscribe(s: (...args: ARGS) => void): () => void;
    unsubscribe(id: number): void;
    notify(...args: ARGS): void;
    unsubscribeAll(): void;
}
```

- `new Publisher<ARGS>()` — typed tuple of event args.
- `subscribe(listener)` — returns an `Unsubscribe` function; keep it for cleanup.
- `notify(...args)` — invoke every subscriber synchronously.
- `unsubscribeAll()` — clear all listeners (e.g. on dispose).

## Rules

- Do not use `Publisher` as a state container — if you need `get`/`set`, use `Observable`.
- Always keep and call the returned unsubscribe function to avoid leaks.
- Emitted arguments must match the declared tuple type.

## Example: typed event bus

```ts
type Events = [event: "created" | "deleted", id: string];

const events = new Publisher<Events>();

events.subscribe((event, id) => {
    if (event === "created") console.log("new", id);
});

events.notify("created", "post-123");
```
