# @efesto-cloud/result

A minimal `Result<T, E>` monad for representing the outcome of operations that can succeed or fail without throwing.

## Installation

```bash
pnpm add @efesto-cloud/result
```

## Quick Start

```ts
import Result from "@efesto-cloud/result";

function parseAge(input: string): Result<number, string> {
    const n = Number.parseInt(input, 10);
    if (Number.isNaN(n)) return Result.err("not a number");
    return Result.ok(n);
}

const r = parseAge("42");
if (r.isFailure()) {
    console.error(r.error);
} else {
    console.log(r.data);
}
```

## Core Rules

- Create success with `Result.ok(value)`.
- Create failure with `Result.err(error)`.
- Check outcome with `result.isFailure()` or `result.isSuccess()`.
- Throw only when explicitly desired with `result.unwrapOrThrow()`.
- For fallback values, use `result.else(() => fallback)`.
- Collapse to a single value with `result.match({ ok, err })`.

## API

### Constructors

```ts
Result.ok();              // Success<void>
Result.ok(value);         // Success<T>
Result.err(error);        // Failure<E> — the error is required

Result.fromObject({ success: true, data }); // rebuild from serialized form
Result.fromZod(zodSchema.safeParse(input)); // from Zod's safeParse result
Result.fromSchema(standardSchema, input);   // from any Standard Schema (zod-independent)
```

### Instance methods

| Method | Purpose |
| --- | --- |
| `isSuccess()` / `isFailure()` | Type guards. |
| `unwrapOrThrow()` | Return `data` or throw `error`. Crash-fast only. |
| `map(fn)` | Transform `data`; error passes through. |
| `flatMap(fn)` | Chain another `Result`-returning call. |
| `mapError(fn)` | Transform `error`; data passes through. |
| `match({ ok, err })` | Collapse to a single value. |
| `fold(onErr, onOk)` | **Deprecated** — use `match({ ok, err })` instead. Note: the *error* handler comes first. |
| `else(() => value)` | Provide a fallback `data` when failure. |
| `run(fn)` | Side-effect if success (no-op if failure). |
| `tap(fn)` / `tapError(fn)` | Side-effect on success / on failure; passes through either way. |
| `tapBoth({ ok?, err? })` | Side-effect on whichever branch matched; passes through. |
| `toObject()` | Plain `{ success, data, error }` shape. |

### Collection combinators

```ts
Result.all([r1, r2, r3]);      // Result<[T1, T2, T3], E1 | E2 | E3> — first error short-circuits
Result.partition([r1, r2]);    // [T[], E[]] — does not short-circuit, preserves order
Result.flatten(nested);        // Result<Result<T, E>, F> -> Result<T, E | F>
```

### Static guards

```ts
Result.isOk(result);   // result is Success<T, E>
Result.isErr(result);  // result is Failure<T, E>

results.filter(Result.isOk); // handy in Array.prototype.filter
```

## Common Mistakes To Avoid

- Do not call `result.isErr()` as an instance method — it does not exist,
  use `result.isFailure()`. The standalone `Result.isErr(result)` /
  `isErr(result)` guard does exist (see "Static guards" above).
- Do not use `unwrap()`.
- Do not use `getOr()`.
- Do not pass handlers to `fold` in success-first order — `fold(onErr, onOk)`
  calls the *first* argument with the error. Prefer `match({ ok, err })`.

## Patterns

### Propagate an error

```ts
const created = createSomething(input);
if (created.isFailure()) return Result.err(created.error);
return Result.ok(created.data);
```

### Chain with fallback

```ts
const name = maybeNameResult
    .map((v) => v.trim())
    .else(() => "N/D")
    .unwrapOrThrow();
```

### Serialize / deserialize

```ts
const obj = res.toObject();          // IResult<T, E>
const back = Result.fromObject(obj); // Result<T, E>
```

## Types

```ts
type IResult<T, E> = ISuccess<T, E> | IFailure<E, T>;

interface ISuccess<T, E> { success: true;  data: T; error?: E; }
interface IFailure<E, T> { success: false; data?: T; error: E; }

type OkOf<R> = R extends Result<infer T, infer _E> ? T : never;
type ErrOf<R> = R extends Result<infer _T, infer E> ? E : never;
```
