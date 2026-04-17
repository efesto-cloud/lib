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
- Provide fallback with `else(() => defaultValue)`.
- Convert to `Result` when the caller expects one: `m.toResult()`.

## API

### Constructors

```ts
Maybe.maybe(value);   // Some(value) if non-nullish, otherwise None
Maybe.some(value);    // always Some
Maybe.none();         // always None

Maybe.fromObject({ some: true, data });
Maybe.combine(m1, m2); // Some<[T1, T2]> only if both present
```

### Instance methods

| Method | Purpose |
| --- | --- |
| `isSome()` / `isNone()` | Type guards. |
| `map(fn)` | Transform the contained value. |
| `flatMap(fn)` | Chain another `Maybe`-returning call. |
| `filter(predicate)` | Drop to `None` if predicate fails. |
| `fold(onNone, onSome)` | Collapse to a single value. |
| `else(() => value)` | Provide a fallback value. |
| `run(fn)` | Side-effect if `Some`. |
| `toObject()` | Plain `{ some, data }` shape. |
| `toResult()` | Convert to `Result<T, NoneError>`. |

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
