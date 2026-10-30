---
name: observer
description: Use when writing or reviewing Observable code from the @efesto-cloud/observable package.
argument-hint: "Paste code and ask: 'normalize Observable usage'"
---

# Observer

**Installation:** If not already installed, add the packages:
- `pnpm add @efesto-cloud/observable` (provides `Observable`)
- `pnpm add @efesto-cloud/publisher` (peer dependency for subscription management)

Use this skill when you need reactive state or pub/sub.

## Quick Rule
- `Observable`: hold state (`get`/`set`) and notify on change.
- `Publisher`: emit events (`notify`) without storing state.

## Procedure
1. If you need current value + updates, use `Observable`.
2. If you need fire-and-forget events, use `Publisher`.
3. Always clean subscriptions (`unsubscribe` or returned cleanup fn).

## Common Mistakes
- Using `Publisher` as if it stores state.
- Forgetting to unsubscribe.

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

The `IObservable` interface is defined as follows:

```ts
interface IObservable<T> {
    get(): T;
    set(value: T): void;
    subscribe(callback: (value: T) => void): Unsubscribe;
    dispose(): void;
}
```