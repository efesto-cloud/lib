---
name: monad-result
description: Use when writing or reviewing code that returns Result<T, E> from the @efesto-cloud/result package.
argument-hint: "Paste the code snippet or use case and ask: 'normalize Result handling'"
---

# Result Monad

**Installation:** If not already installed, add the package with `pnpm add @efesto-cloud/result`.

Use this skill to keep `Result<T, E>` usage consistent across the project.

## Core Rules
- Create success with `Result.ok(value)`.
- Create failure with `Result.err(error)`.
- Check outcome with `result.isFailure()` or `result.isSuccess()`.
- Throw only when explicitly desired with `result.unwrapOrThrow()`.
- For fallback values, use `result.else(() => fallback)`.
- Execute side effects with `result.run(fn)` — runs `fn` on success data, no-op on failure.
- Serialize to plain object with `result.toObject()` — returns `ISuccess<T> | IFailure<E>`.
- Deserialize with `Result.fromObject(obj)` — reconstructs from a plain `IResult<T, E>` object.
- Integrate Zod validation with `Result.fromZod(zodParseResult)` — converts `SafeParseReturnType` to `Result`.

## Common Mistakes To Avoid
- Do not call `result.isErr()` as an instance method — it does not exist, use `result.isFailure()`. (The standalone `Result.isErr(result)` guard does exist, e.g. for `Array.prototype.filter`.)
- Do not use `unwrap()`.
- Do not use `getOr()`.
- Do not pass handlers to `fold` in success-first order — `fold(onErr, onOk)` calls the *first* argument with the error. Prefer `match({ ok, err })`, which reads unambiguously and is not deprecated.

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
	- Convert to plain value with fallback: `res.else(() => value)`
	- Crash-fast boundary only: `res.unwrapOrThrow()`
5. If mapping/transformation is needed, use `map`, `flatMap`, `mapError`, or `match({ ok, err })` to collapse to a single value.

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