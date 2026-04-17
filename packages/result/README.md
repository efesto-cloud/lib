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

## API

### Constructors

```ts
Result.ok();              // Success<void>
Result.ok(value);         // Success<T>
Result.err();             // Failure<void>
Result.err(error);        // Failure<E>

Result.fromObject({ success: true, data }); // rebuild from serialized form
Result.fromZod(zodSchema.safeParse(input)); // from Zod's safeParse result
```

### Instance methods

| Method | Purpose |
| --- | --- |
| `isSuccess()` / `isFailure()` | Type guards. |
| `unwrapOrThrow()` | Return `data` or throw `error`. Crash-fast only. |
| `map(fn)` | Transform `data`; error passes through. |
| `flatMap(fn)` | Chain another `Result`-returning call. |
| `mapError(fn)` | Transform `error`; data passes through. |
| `fold(onErr, onOk)` | Collapse to a single value. |
| `else(() => value)` | Provide a fallback `data` when failure. |
| `run(fn)` | Side-effect if success (no-op if failure). |
| `toObject()` | Plain `{ success, data, error }` shape. |

## Common Mistakes To Avoid

- Do not use `isErr()`.
- Do not use `unwrap()`.
- Do not use `getOr()`.

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
```
