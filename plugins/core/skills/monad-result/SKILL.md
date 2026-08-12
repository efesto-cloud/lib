---
name: monad-result
description: Use when writing or reviewing code that returns Result<T, E> from the @efesto-cloud/result package, or Toast<T, E> from @efesto-cloud/toast.
argument-hint: "Paste the code snippet or use case and ask: 'normalize Result handling'"
---

# Result Monad

**Installation:** If not already installed, add the package with `pnpm add @efesto-cloud/result`.

Use this skill to keep `Result<T, E>` usage consistent across the project.

## Core Rules
- Create success with `Result.ok(value)`. Call `Result.ok()` with no argument for `Result<void, never>`.
- Create failure with `Result.err(error)`.
- Check outcome with `result.isFailure()` or `result.isSuccess()`.
- Throw only when explicitly desired with `result.unwrapOrThrow()`.
- For fallback values, use `result.unwrapOr(fallback)` (eager value) or `result.else(() => fallback)` (lazy, returns a `Result`).
- Execute side effects with `result.tap(fn)` / `result.tapError(fn)` (return `this`) or `result.run(fn)` (returns `void`, success only).
- Serialize to plain object with `result.toObject()` — returns `ISuccess<T> | IFailure<E>`.
- Deserialize with `Result.fromObject(obj)` — reconstructs from a plain `IResult<T, E>` object.
- Integrate Zod validation with `Result.fromZod(zodSafeParseResult)` — converts a `ZodSafeParseResult` to `Result<Output, ZodError>`.
- Wrap throwing functions with `Result.fromThrowable(fn, errorMapper)` — returns a function that yields a `Result`.

Both module-level imports (`import { ok, err } from "@efesto-cloud/result"`) and the default-export namespace (`import Result from "@efesto-cloud/result"`, then `Result.ok(...)`) are available and alias the same implementations.

## Combinators
- `map(fn)` — transform `data`; error passes through.
- `mapError(fn)` — transform `error`; data passes through.
- `flatMap(fn)` / `andThen(fn)` — chain another `Result`-returning call (`andThen` is an alias of `flatMap`).
- `orElse(fn)` — recover from failure with a `Result`-returning function.
- `match(onOk, onErr)` / `fold(onErr, onOk)` — collapse to a single value (note the argument order differs).

## Async
For asynchronous workflows use the companion `@efesto-cloud/result-async` package: `ResultAsync<T, E>` wraps a `Promise<Result<T, E>>`, is awaitable, and exposes the same fluent surface (`map`, `mapError`, `flatMap`/`andThen`, `orElse`, `match`, `tap`, `tapError`, `unwrapOr`, `unwrapOrThrow`). Create with `okAsync`, `errAsync`, `fromPromise`, `fromSafePromise`, or `fromThrowable`.

## Toast — a Result with a user-facing message
For results that surface to the UI use the companion `@efesto-cloud/toast` package (`pnpm add @efesto-cloud/toast`). A `Toast<T, E>` is a `ToastSuccess<T, E> | ToastFailure<T, E>` that carries the same `data`/`error` as a `Result` plus a human-readable `message`. It exposes the same fluent surface as `Result` (`map`, `mapError`, `flatMap`/`andThen`, `orElse`, `match`, `tap`, `tapError`, `unwrapOr`, `unwrapOrThrow`, plus `fold`/`else`/`run` compat aliases) and narrows with `isSuccess()` / `isFailure()`.
- Create with `Toast.ok(message, value?)` and `Toast.err(message, error?)` (both accept the default-export namespace or the module-level `ok`/`err` named exports).
- Bridge from a `Result` with `Toast.fromResult(result)`, `Toast.fromResult(result, okMessage)`, or `Toast.fromResult(result, okMessage, errMessage)` — when no `errMessage` is given it derives one from a string error or an `error.message`.
- Reconstruct a plain object with `Toast.fromObject(obj)`; serialize with `toObject()`; convert to a `Maybe<T>` with `toMaybe()`.

```ts
import Toast from "@efesto-cloud/toast";

const saved = save(input); // Result<User, AppError>
const toast = Toast.fromResult(saved, "Saved!");
toast.match(
	(user) => showSuccess(toast.message, user),
	(err) => showError(toast.message, err),
);
```

## Common Mistakes To Avoid
- Do not use `isErr()` — use `isFailure()`.
- Do not use `unwrap()` — use `unwrapOrThrow()` or `unwrapOr()`.
- Do not use `getOr()` — use `unwrapOr()` or `else()`.

## Procedure
1. Identify where `Result<T, E>` is created and returned.
2. Standardize constructors:
	- success branch -> `Result.ok(...)`
	- error branch -> `Result.err(...)`
3. Standardize branching:
	- Prefer `if (res.isFailure()) return Result.err(res.error);`
	- Else continue with `res.data`
4. Decide consumption style:
	- Propagate error: branch on `isFailure()`
	- Convert to plain value with fallback: `res.unwrapOr(value)` or `res.else(() => value)`
	- Collapse both branches: `res.match(onOk, onErr)` or `res.fold(onErr, onOk)`
	- Crash-fast boundary only: `res.unwrapOrThrow()`
5. If mapping/transformation is needed, use `map`, `flatMap`/`andThen`, `mapError`, or `orElse`.

## Quick Patterns
```ts
const created = createSomething(input);
if (created.isFailure()) return Result.err(created.error);

return Result.ok(created.data);
```

```ts
const name = maybeNameResult
	 .map((v) => v.trim())
	 .else(() => "N/D")
	 .unwrapOrThrow();
```