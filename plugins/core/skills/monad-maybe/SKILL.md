---
name: monad-maybe
description: Use when writing or reviewing code that returns Maybe<T> from the @efesto-cloud/maybe package.
argument-hint: "Paste the code snippet or use case and ask: 'normalize Maybe handling'"
---

# Maybe Monad

**Installation:** If not already installed, add the package with `pnpm add @efesto-cloud/maybe`.

Use this skill to keep `Maybe<T>` usage simple and predictable.

## Core Rules
- Wrap optional value with `Maybe.maybe(value)`.
- Build explicit presence with `Maybe.some(value)`.
- Build explicit absence with `Maybe.none()`.
- Check state with `isSome()` / `isNone()`.
- Transform with `map(fn)`, chain with `flatMap(fn)` / `andThen(fn)`, narrow with `filter(predicate)`.
- Extract with `unwrapOr(fallback)`; use `unwrapOrThrow()` only when a missing value is a programmer error (throws `NoneError`).
- Convert to `Result` when needed with `toResult()` — returns `Result<T, NoneError>`.
- Pattern match with `match(onSome, onNone)` when both branches need to return the same type.
- Run side effects with `tap(fn)` (when Some) / `tapNone(fn)` (when None); both pass the `Maybe` through.
- Serialize to plain object with `toObject()` — returns `ISome<T> | INone`.
- Deserialize with `Maybe.fromObject(obj)` — reconstructs from `{ some: boolean, data: T | null }`.
- Wrap a throwing/nullish-returning function with `Maybe.fromThrowable(fn)` — returns `(...args) => Maybe<T>`.
- Combine two Maybes with `Maybe.combine(m1, m2)` — returns `Maybe<[T1, T2]>`.

### Compatibility aliases
These older names still exist; prefer the modern equivalents above.
- `fold(onNone, onSome)` → prefer `match(onSome, onNone)` (note the swapped argument order).
- `run(fn)` → prefer `tap(fn)`.
- `else(() => value)` → prefer `unwrapOr(value)` when you want the raw value. Note `else` returns a `Maybe<T>` (Some when None), so chains often end with `.data`.

## Async variant
For asynchronous workflows use `@efesto-cloud/maybe-async` (`MaybeAsync<T>`), which wraps a `Promise<Maybe<T>>` and exposes the same fluent surface (`map`, `flatMap`/`andThen`, `filter`, `orElse`, `match`, `tap`, `tapNone`, `unwrapOr`, `unwrapOrThrow`). Construct with `maybeAsync(value)`, `someAsync(value)`, `noneAsync()`, or bridge promises with `fromPromise`, `fromSafePromise`, `fromThrowable`. A `MaybeAsync` is `await`-able and resolves to the underlying `Maybe<T>`.

## Common Mistakes To Avoid
- Do not treat `Maybe` like `Result`.
- Do not use `isFailure` on `Maybe`.
- Do not access `.data` without checking `isSome()` first.

## Procedure
1. Identify nullable or optional source values.
2. Convert early to `Maybe` (`Maybe.maybe(value)`).
3. Use one handling style consistently:
   - Branching: `if (m.isNone()) ... else m.data`
   - Functional: `map`, `flatMap`/`andThen`, `filter`, `match`
   - Fallback: `m.unwrapOr(defaultValue)`
4. If caller expects `Result<T, E>`, convert once with `toResult()` and continue in Result flow.

## Quick Patterns
```ts
const maybeEmail = Maybe.maybe(input.email);
if (maybeEmail.isNone()) return Result.err(new Error("Missing email"));

return Result.ok(maybeEmail.data.trim());
```

```ts
const displayName = Maybe.maybe(user.nickname)
	.filter((v) => v.length > 0)
	.else(() => user.nome)
	.data;
```