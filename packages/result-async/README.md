# @efesto-cloud/result-async

Asynchronous `Result<T, E>` for representing the outcome of operations that can succeed or fail without throwing. Companion to [`@efesto-cloud/result`](../result).

## Installation

```bash
pnpm add @efesto-cloud/result-async
```

## Quick Start

```ts
import ResultAsync, { okAsync, errAsync } from "@efesto-cloud/result-async";

declare function loadUser(id: string): Promise<User>; // may reject

function safeLoadUser(id: string) {
    return ResultAsync.fromPromise(loadUser(id), (e) => new DbError(e));
}

const r = await safeLoadUser("42");
if (r.isFailure()) {
    console.error(r.error);
} else {
    console.log(r.data.name);
}
```

## Core Rules

- Wrap a rejecting Promise with `ResultAsync.fromPromise(p, mapErr)`.
- Wrap a non-rejecting Promise with `ResultAsync.fromSafePromise(p)`.
- Create from a value with `okAsync(value)` / `errAsync(error)`.
- `await` a `ResultAsync<T, E>` to get a `Result<T, E>`.
- Use `unwrapOrThrow()` only when crashing fast is the intended behavior.

## API

### Constructors

```ts
okAsync(value);                                       // ResultAsync<T, never>
errAsync(error);                                      // ResultAsync<never, E>

ResultAsync.fromPromise(p, (e) => mapped);            // wrap a rejecting promise
ResultAsync.fromSafePromise(p);                       // wrap a non-rejecting promise
ResultAsync.fromThrowable(asyncFn, (e) => mapped);    // wrap an async function
```

### Instance methods

| Method | Purpose |
| --- | --- |
| `then(...)` | Implements `PromiseLike`, so `await ra` returns `Result<T, E>`. |
| `map(fn)` | Transform `data`; error passes through. `fn` may be async. |
| `mapError(fn)` | Transform `error`; data passes through. `fn` may be async. |
| `flatMap(fn)` / `andThen(fn)` | Chain another `Result` / `ResultAsync` / `Promise<Result>`. |
| `orElse(fn)` | Recover from a failure by returning a new Result/ResultAsync. |
| `match(onOk, onErr)` | Collapse to a single value. Returns a `Promise`. |
| `tap(fn)` | Side-effect on success; passes the value through. |
| `tapError(fn)` | Side-effect on failure; passes the value through. |
| `unwrapOr(fallback)` | Returns `Promise<T \| U>` — data or fallback. |
| `unwrapOrThrow()` | Returns `Promise<T>` or throws the error. |

## Patterns

### Chain two async calls

```ts
function loadProfile(id: string) {
    return ResultAsync.fromPromise(fetchUser(id), toDbError)
        .andThen((user) =>
            ResultAsync.fromPromise(fetchPosts(user.id), toDbError).map(
                (posts) => ({ user, posts }),
            ),
        );
}
```

### Bridge from a sync `Result`

```ts
import { ok } from "@efesto-cloud/result";

function start() {
    return okAsync(1).andThen((n) => ok(n + 1)); // ResultAsync<number, never>
}
```

### Recover

```ts
const safe = riskyAsync().orElse((e) =>
    e.kind === "transient" ? okAsync(0) : errAsync(e),
);
```
