# @efesto-cloud/maybe

A minimal `Maybe<T>` monad for expressing optional values without `null`/`undefined` at the call site.

## Installation

```bash
pnpm add @efesto-cloud/maybe @efesto-cloud/result
```

## Quick Start

```ts
import Maybe from "@efesto-cloud/maybe";

const maybeEmail = Maybe.maybe(user.email);

const displayName = Maybe.maybe(user.nickname)
    .filter((v) => v.length > 0)
    .else(() => user.fullName)
    .data;
```

## Core Rules

- Wrap an optional value with `Maybe.maybe(value)`.
- Build explicit presence with `Maybe.some(value)`.
- Build explicit absence with `Maybe.none()`.
- Check state with `isSome()` / `isNone()`.
- Extract with `unwrapOr(fallback)`; use `unwrapOrThrow()` only when a missing
  value is a programmer error (throws `NoneError`).
- Convert to `Result` when the caller expects one: `m.toResult()`.

Factories are available both as namespace members (`Maybe.some(...)`) and as
named imports (`import { some, none, maybe } from "@efesto-cloud/maybe"`).

## API

### Constructors

```ts
maybe(value);   // Some(value) if non-nullish, otherwise None
some(value);    // always Some
none();         // always None

fromObject({ some: true, data });
fromThrowable(fn);   // (...args) => Maybe<T>; None if fn throws or returns nullish
combine(m1, m2);     // Some<[T1, T2]> only if both present
```

### Instance methods

| Method | Purpose |
| --- | --- |
| `isSome()` / `isNone()` | Type guards. |
| `map(fn)` | Transform the contained value. |
| `flatMap(fn)` / `andThen(fn)` | Chain another `Maybe`-returning call. |
| `filter(predicate)` | Drop to `None` if predicate fails. |
| `match(onSome, onNone)` | Collapse to a single value (some-first). |
| `tap(fn)` | Side-effect if `Some`; passes through. |
| `tapNone(fn)` | Side-effect if `None`; passes through. |
| `unwrapOr(fallback)` | Contained value, or `fallback` if `None`. |
| `unwrapOrThrow()` | Contained value, or throws `NoneError`. |
| `toObject()` | Plain `{ some, data }` shape. |
| `toResult()` | Convert to `Result<T, NoneError>`. |

#### Compatibility aliases

| Method | Prefer |
| --- | --- |
| `fold(onNone, onSome)` | `match(onSome, onNone)` |
| `run(fn)` | `tap(fn)` |
| `else(() => value)` | `unwrapOr(value)` when you want the raw value |

## Common Mistakes To Avoid

- Do not treat `Maybe` like `Result` — there is no `isFailure`.
- Do not access `.data` without checking `isSome()` first.

## Patterns

### Convert to `Result` at a boundary

```ts
const maybeEmail = Maybe.maybe(input.email);
if (maybeEmail.isNone()) return Result.err(new Error("Missing email"));
return Result.ok(maybeEmail.data.trim());
```

### Fallback chain

```ts
const displayName = Maybe.maybe(user.nickname)
    .filter((v) => v.length > 0)
    .else(() => user.fullName)
    .data;
```

## Types

```ts
type IMaybe<T> = ISome<T> | INone;

interface ISome<T> { some: true;  data: T; }
interface INone   { some: false; data: null; }
```

Only `NonNullable` types are allowed as `Some`'s payload.
