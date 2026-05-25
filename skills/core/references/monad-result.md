# `Result<T, E>`

The error-handling backbone. From `@efesto-cloud/result`. Used by
value-object factories, entity factories, entity mutators, use cases,
and any service that has a recognised failure mode.

## The constructors

```ts
import Result from "@efesto-cloud/result";

const ok: Result<number, never> = Result.ok(42);
const err: Result<never, MyError> = Result.err(new MyError());
```

- `Result.ok(value)` — success branch.
- `Result.err(error)` — failure branch.

The error must be a non-null value; `Result.err(undefined)` defeats
the purpose. Prefer a real error class.

## The two states

```ts
const result = doSomething();

if (result.isFailure()) {
    // result.error : E
    return Result.err(result.error);
}
// result.data : T
const value = result.data;
```

`isFailure()` and `isSuccess()` narrow the type so `result.data` and
`result.error` are accessible without further casts. Use one form
consistently within a function — usually `isFailure()` because the
early-return-on-failure pattern is the most common shape.

## The propagation pattern

```ts
const a = stepA();
if (a.isFailure()) return Result.err(a.error);

const b = stepB(a.data);
if (b.isFailure()) return Result.err(b.error);

return Result.ok(b.data);
```

This is the canonical shape of a multi-step Result-returning function.
Three lines per step:

1. Call.
2. Branch on failure → return the error wrapped.
3. Continue with `.data`.

If chaining is repetitive, the functional helpers (below) help.

## Transformations

| Method | Signature | What it does |
|--------|-----------|-------------|
| `.map(fn)` | `Result<T, E>.map(t -> u): Result<U, E>` | Transform the success value; pass through on failure. |
| `.flatMap(fn)` | `Result<T, E>.flatMap(t -> Result<U, E>): Result<U, E>` | Same but the function itself returns a `Result`. |
| `.mapError(fn)` | `Result<T, E>.mapError(e -> e2): Result<T, E2>` | Transform the error; pass through on success. |
| `.fold(onSuccess, onFailure)` | Both branches return the same type | Collapse to a single value. |

`flatMap` is the workhorse for chaining Result-returning steps:

```ts
return FooName.create(input.name)
    .flatMap((name) => Foo.create({ name }, clock))
    .map((foo) => foo.toDTO());
```

Equivalent to the propagation pattern but tighter when each step's
output is the next step's input. Use whichever reads more clearly.

## Fallbacks

`.else(() => fallback)` collapses a failure to a known value:

```ts
const fooName = FooName.create(input.name)
    .else(() => FooName.create("Untitled").unwrapOrThrow())
    .data;
```

(That example is slightly contrived because chaining `.else` after a
fallback is the same as the original; the value comes from the
fallback only when the original failed.)

## Unwrapping

`.unwrapOrThrow()` — throw the error if failure, return the data if
success. Use at boundaries where throwing is intentional:

```ts
// In a route loader, at the framework boundary:
const result = await useCase.execute(input);
return { foo: result.unwrapOrThrow() };  // React Router catches the throw
```

The throw produces an HTTP 500 by default in React Router's error
envelope. Use this style only when the failure means "server bug"; if
it's a user-facing failure, branch on `isFailure()` and translate to
a meaningful response.

`.unwrap()` does **not** exist on the project's Result. Don't try to
use it — the only unwrap path is the explicit
`unwrapOrThrow()`.

## Serialisation

`Result` can be serialised to a plain object:

```ts
const obj = result.toObject();
// { success: true, data: T } | { success: false, error: E }

const reconstructed = Result.fromObject(obj);
```

Useful when sending Results across the wire (rare — most boundaries
serialise the DTO directly, not the Result).

## Zod integration

`Result.fromZod(zodParseResult)` converts a Zod `SafeParseReturnType`:

```ts
import { z } from "zod";

const InputSchema = z.object({ name: z.string().min(1) });

const parsed = Result.fromZod(InputSchema.safeParse(rawInput));
if (parsed.isFailure()) {
    // parsed.error is a Zod issue array
    return Result.err(new ValidationError(parsed.error));
}
// parsed.data is the typed object
```

Used in route loaders/actions for input shaping. The use case's
input type is then the parsed-and-typed object.

## Anti-patterns

- **`isErr()`** — not part of the API. Use `isFailure()`.
- **`unwrap()`** — not part of the API. Use `unwrapOrThrow()`.
- **`getOr()`** — not part of the API. Use `.else(() => default).data`
  or `.unwrapOrThrow()` plus an outer try/catch.
- **Throwing inside a Result-returning function.** If the function's
  type is `Result<T, E>`, it never throws — that's the contract.
  Wrap any throwing dependency in a try/catch and produce
  `Result.err(...)`.
- **Returning `Result<T, never>`.** If the function can't fail, drop
  the Result wrapper. `Result<T, never>` is noise.

## Cross-layer where it shows up

- **VO factories**: `static create(raw): Result<FooName, InvalidFooNameError>`.
- **Entity factories**: `static create(props, clock): Result<Foo, DomainError>`.
- **Entity mutators**: `rename(input, clock): Result<void, DomainError>`.
- **Service ports**: `IMemberAuthenticator.authenticateWithPassword(...):
  Promise<Result<MemberDto, InvalidCredentialsError>>`.
- **Use cases**: `execute(input): Promise<Result<FooDto, DomainError>>`.
- **Route loaders/actions**: branch on the use case's Result and
  translate to HTTP. The `unwrapOrThrow` style is also valid at this
  boundary if "any failure = 500" is the desired behaviour.

## Procedure for adding a Result-returning function

1. Decide the success type `T` and the error type `E`.
2. Use `Result.ok(...)` and `Result.err(...)` to construct.
3. For multi-step bodies, use the propagation pattern (`if
   (step.isFailure()) return Result.err(step.error)`).
4. For chaining, use `.map` / `.flatMap` / `.mapError`.
5. At the call site, branch on `.isFailure()` or use `.else(...)`
   for a fallback.
6. At a framework boundary where throw is the right answer, use
   `.unwrapOrThrow()`.

## Quick reference

```ts
// Construct
Result.ok(value);
Result.err(error);

// Check
result.isSuccess();
result.isFailure();

// Access
result.data;        // available after isSuccess() narrowed
result.error;       // available after isFailure() narrowed

// Transform
result.map((t) => u);
result.flatMap((t) => Result.ok(u));
result.mapError((e) => e2);
result.fold(
    (t) => /* on success */,
    (e) => /* on failure */,
);

// Fallback / unwrap
result.else(() => fallback).data;
result.unwrapOrThrow();

// Serialise
result.toObject();
Result.fromObject(obj);
Result.fromZod(zodParseResult);
```
