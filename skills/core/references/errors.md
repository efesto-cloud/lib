# Errors

Domain errors. One concrete class per condition. Live in
`core/src/errors/`. Returned via `Result.err(...)`, never thrown
inside the domain.

## The base class

```ts
// core/src/errors/DomainError.ts
export default abstract class DomainError extends Error {
    constructor(message?: string, options?: ErrorOptions) {
        super(message, options);
        this.name = new.target.name;
    }
}
```

Two things matter:

- **`abstract`** — you never `new DomainError()` directly. Every
  concrete error subclasses this.
- **`this.name = new.target.name`** — instances report their class
  name (`"MemberNotFoundError"`, not `"Error"`). That makes
  `error.name === "MemberNotFoundError"` a reliable discriminator at
  the route loader / action layer.

## One class per condition

```ts
// core/src/errors/FooNotFoundError.ts
import DomainError from "./DomainError.js";
export default class FooNotFoundError extends DomainError {}
```

```ts
// core/src/errors/InvalidFooNameError.ts
import DomainError from "./DomainError.js";
export default class InvalidFooNameError extends DomainError {}
```

That's it. Empty bodies. The class name **is** the error. Don't add
codes, messages, or fields unless there's a concrete need.

Why parameterless?

- The class is the discriminator. No code is needed; the class
  identity carries the meaning.
- Messages add stress to translation (it-IT locale) — the UI is the
  right place to translate, not the error.
- A field like `cause: string` invites inconsistency. If you need to
  pass extra context, declare a specific subclass with a typed field.

When you genuinely need parameters:

```ts
export default class FooFieldTooLongError extends DomainError {
    constructor(readonly field: string, readonly maxLength: number) {
        super();
    }
}
```

Use sparingly. The default is parameterless.

## Where to put errors

Two valid organisations:

### Per-entity grouping

If the error is tied to one entity's invariants:

```
core/src/errors/
├── DomainError.ts
├── InvalidFooNameError.ts
├── FooNotFoundError.ts
├── FooAlreadyExistsError.ts
└── index.ts
```

This is the default in `task-planning`. Browsing the errors folder
gives a quick map of what can go wrong in the domain.

### Per-use-case grouping (rare)

If an error is only ever raised by one use case and never travels:

```
core/src/useCase/foos/errors/CannotPublishWithoutNameError.ts
```

Use case-local errors are exceptional. When in doubt, put them in
`core/src/errors/` — promoting from local to shared is a rename;
demoting is a refactor.

## How errors flow through `Result`

The whole pipeline carries `DomainError`:

```ts
// VO factory:
static create(raw: string): Result<FooName, InvalidFooNameError> { ... }

// Entity factory:
static create(props): Result<Foo, DomainError> { ... }

// Use case:
async execute(input): Promise<Result<FooDto, DomainError>> { ... }

// Route loader:
const result = await useCase.execute(input);
if (result.isFailure()) {
    if (result.error.name === "FooNotFoundError") {
        throw new Response(null, { status: 404 });
    }
    throw result.error;  // re-raise; framework error envelope handles it
}
return { foo: result.data };
```

The union widening from `InvalidFooNameError` → `DomainError` is
deliberate: the use case's caller usually doesn't want to know every
possible failure, just whether one happened.

When the caller *does* want to know — e.g. an action returning a
form-friendly response — switch on `error.name`:

```ts
if (result.isFailure()) {
    switch (result.error.name) {
        case "InvalidFooNameError":
            return { ok: false, field: "name", message: "Nome non valido" };
        case "FooNotFoundError":
            throw new Response(null, { status: 404 });
        default:
            throw result.error;
    }
}
```

## Why this pattern over Zod / typed-errors libs

Zod validates parsing — useful at the loader boundary for input
shaping. It's not the right tool for domain rules ("a Member can't
have a duplicate code"), which need entity- or repo-level state.

Typed-errors libraries (`ts-results`, `effect-ts`) usually require
heavy wrapping. The repo already has `@efesto-cloud/result`; layering
another library on top adds friction.

The simple `DomainError` base + class-per-condition pattern stays
out of the way and works with the `Result` monad already in use.

## Cross-layer: how to choose the right error

- **Validation failed inside a VO factory** → custom error for that
  VO. E.g. `InvalidEmailFormatError` from `EmailAddress.create`.
- **Invariant failed inside an entity mutator** → entity-specific
  error. E.g. `EmptyMemberNameError`.
- **Concurrency / not-found in the use case** → use-case-or-entity-
  specific error. `FooNotFoundError`, `FooAlreadyExistsError`.
- **External system failure** (DB connection refused, network
  error) — these are infrastructure errors, not domain errors. Let
  them bubble as native exceptions and let the route's error handler
  return a 500.

## Errors and the route layer

The route's job is to translate `DomainError` instances into HTTP
shapes. A typical mapping:

| Error class suffix | HTTP code |
|--------------------|-----------|
| `*NotFoundError` | 404 |
| `Invalid*Error` / `*FormatError` | 400 |
| `*AlreadyExistsError` | 409 |
| `Weak*Error` / `*PolicyError` | 422 |
| `Unauthorised*Error` / `NotLoggedError` | 401 |
| `Forbidden*Error` | 403 |
| anything else | 500 |

This mapping isn't enforced by code — it lives in the route
loaders/actions. Pick something consistent across the app and document
it (e.g. in a `webapp/app/errors.server.ts` helper).

## Authentication errors — special case

The webapp's `requireMember` throws a 401 `Response` directly when
the actor can't be resolved. Use cases that take an actor open with a
null-guard:

```ts
async execute(input, context): Promise<Result<FooDto, DomainError>> {
    if (context.actor === null) {
        throw new Error("Actor required");  // programming bug, not domain
    }
    // ...
}
```

The thrown `Error` here is fine because reaching the use case
without an actor would be a wiring bug, not a user-facing failure.

## Checklist — new error

- [ ] File `core/src/errors/<Condition>Error.ts`.
- [ ] Extends `DomainError`.
- [ ] Class name ends with `Error`.
- [ ] Parameterless constructor (unless an extra field is genuinely
      needed).
- [ ] Re-exported from `core/src/errors/index.ts`.
- [ ] Returned via `Result.err(new <Condition>Error())` from the
      VO / entity / use case.
- [ ] Route loader / action mapped to an HTTP response if the error
      is user-facing.

## "Seen in the wild"

- `packages/core/src/errors/DomainError.ts` — the abstract base.
- `packages/core/src/errors/MemberNotFoundError.ts`,
  `packages/core/src/errors/MemberEmailAlreadyExistsError.ts`,
  `packages/core/src/errors/InvalidEmailFormatError.ts`,
  `packages/core/src/errors/WeakPasswordError.ts`,
  `packages/core/src/errors/EmptyMemberNameError.ts`,
  `packages/core/src/errors/InvalidMemberCodeError.ts` — all
  parameterless one-liners.
