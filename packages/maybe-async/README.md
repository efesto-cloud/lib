# @efesto-cloud/maybe-async

Asynchronous `Maybe<T>` for expressing optional values produced by async work
without `null`/`undefined` at the call site. Companion to
[`@efesto-cloud/maybe`](../maybe).

## Installation

```bash
pnpm add @efesto-cloud/maybe-async @efesto-cloud/maybe
```

## Quick Start

```ts
import MaybeAsync, { maybeAsync, noneAsync } from "@efesto-cloud/maybe-async";

declare function findUser(id: string): Promise<User | null>; // may reject

function lookupUser(id: string) {
    return MaybeAsync.fromPromise(findUser(id)); // rejection or null -> None
}

const displayName = await lookupUser("42")
    .map((user) => user.nickname)
    .filter((n) => n.length > 0)
    .unwrapOr("anonymous");
```

## Core Rules

- Wrap a promise of an optional value with `MaybeAsync.fromPromise(p)` — a
  rejection or a nullish resolution both become `None`.
- Use `MaybeAsync.fromSafePromise(p)` only when `p` never rejects.
- Create from a value with `someAsync(value)` / `noneAsync()` / `maybeAsync(value)`.
- `await` a `MaybeAsync<T>` to get a `Maybe<T>`.
- Use `unwrapOrThrow()` only when a missing value is a programmer error
  (throws `NoneError`).

Only `NonNullable` types are allowed as the contained value.

## API

### Constructors

```ts
someAsync(value);                       // MaybeAsync<T> — always Some
noneAsync();                            // MaybeAsync<never> — always None
maybeAsync(value);                      // Some if non-nullish, otherwise None

MaybeAsync.fromPromise(p);              // rejection or null -> None
MaybeAsync.fromSafePromise(p);          // wrap a non-rejecting promise
MaybeAsync.fromThrowable(asyncFn);      // wrap an async function; throw -> None
```

### Instance methods

| Method | Purpose |
| --- | --- |
| `then(...)` | Implements `PromiseLike`, so `await ma` returns `Maybe<T>`. |
| `map(fn)` | Transform the contained value. `fn` may be async. |
| `flatMap(fn)` / `andThen(fn)` | Chain another `Maybe` / `MaybeAsync` / `Promise<Maybe>`. |
| `filter(predicate)` | Drop to `None` if predicate fails. `predicate` may be async. |
| `orElse(fn)` | Recover from `None` by returning a new Maybe/MaybeAsync. |
| `match(onSome, onNone)` | Collapse to a single value (some-first). Returns a `Promise`. |
| `tap(fn)` | Side-effect if `Some`; passes through. |
| `tapNone(fn)` | Side-effect if `None`; passes through. |
| `unwrapOr(fallback)` | Returns `Promise<T \| U>` — value or fallback. |
| `unwrapOrThrow()` | Returns `Promise<T>` or throws `NoneError`. |

## Patterns

### Chain two async lookups

```ts
function loadProfile(id: string) {
    return MaybeAsync.fromPromise(fetchUser(id)).andThen((user) =>
        MaybeAsync.fromPromise(fetchAvatar(user.id)).map((avatar) => ({
            user,
            avatar,
        })),
    );
}
```

### Bridge from a sync `Maybe`

```ts
import { some } from "@efesto-cloud/maybe";

function start() {
    return maybeAsync(1).andThen((n) => some(n + 1)); // MaybeAsync<number>
}
```

### Recover

```ts
const value = await lookupPrimary(id)
    .orElse(() => lookupFallback(id))
    .unwrapOr(0);
```
