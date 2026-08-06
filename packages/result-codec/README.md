# @efesto-cloud/result-codec

A codec for `Result<T, E>` values that cross a serialized boundary — a
React Router loader/action response, a queue message, anything that goes
through `JSON.stringify`/`JSON.parse`. Validates with
[Standard Schema](https://standardschema.dev), one schema per branch (`ok`
/ `err`) per direction (`serialize` / `deserialize`) — four schemas total.

`deserialize` returns a `Result` whose error union is `DecodeError | <your
domain errors>`, flattened side by side: "the domain said no" and "the
payload wasn't what we expected" are both just tags, handled by the same
exhaustive `matchError`.

## Installation

```bash
pnpm add @efesto-cloud/result-codec @efesto-cloud/result @efesto-cloud/tagged-error
```

Most real schemas are zod schemas (Standard Schema-compatible), so add it
too:

```bash
pnpm add zod
```

See **Known limitations → 1** below before skipping this step.

## Quick Start

Server — a React Router loader that returns a domain `Result`:

```ts
import Result from "@efesto-cloud/result";
import { codec } from "@efesto-cloud/result-codec";
import { TaggedError } from "@efesto-cloud/tagged-error";
import { taggedErrorSchema } from "@efesto-cloud/tagged-error";
import { z } from "zod";

export class UserNotFound extends TaggedError("UserNotFound") {}
export class UserForbidden extends TaggedError("UserForbidden")<{
    motivo: string;
}> {}

const UserSchema = z.object({ id: z.string(), nome: z.string() });
const UserErrSchema = taggedErrorSchema(UserNotFound, UserForbidden);

export const userCodec = codec({
    serialize: { ok: UserSchema, err: UserErrSchema },
    deserialize: { ok: UserSchema, err: UserErrSchema },
});

// app/routes/user.tsx
export async function loader() {
    const result: Result<
        { id: string; nome: string },
        UserNotFound | UserForbidden
    > = await getUser();
    return userCodec.serializeUnsafe(result); // IResult<...> — a plain, JSON-safe object
}
```

Client — the same route's component, deserializing what the loader sent
(`loaderData` is whatever `useLoaderData()`/`loader.data` gives you —
already JSON-parsed, still untyped as far as the codec is concerned):

```ts
import { matchError } from "@efesto-cloud/tagged-error";
import { userCodec } from "./user.server.js";

type ViewState =
    | { kind: "user"; id: string; nome: string }
    | { kind: "empty" }
    | { kind: "forbidden"; reason: string }
    | { kind: "error" };

function toViewState(loaderData: unknown): ViewState {
    const decoded = userCodec.deserialize(loaderData);
    if (decoded.isFailure()) {
        // decoded.error : UserNotFound | UserForbidden | DecodeError
        return matchError(decoded.error, {
            UserNotFound: (): ViewState => ({ kind: "empty" }),
            UserForbidden: (e): ViewState => ({ kind: "forbidden", reason: e.motivo }),
            DecodeError: (): ViewState => ({ kind: "error" }), // schema drift, corrupt payload, …
        });
    }
    return { kind: "user", ...decoded.data };
}
```

One `matchError` covers both "the server told us no" (`UserNotFound`,
`UserForbidden`) and "we couldn't even parse what the server sent"
(`DecodeError`) — no separate `try`/`catch` or ad-hoc shape-checking layer
in the component.

## Core Rules

- Build a codec with `codec({ serialize: { ok, err }, deserialize: { ok, err } })`
  — four Standard Schema validators. `serialize`'s schemas validate domain
  values (`In<S>`) and produce wire values (`Out<S>`); `deserialize`'s do
  the reverse.
- `serialize`/`deserialize` never throw on bad *data* — they return
  `Result<_, EncodeError>` / `Result<_, DecodeError | ...>`. The
  `*Unsafe` variants throw instead, for boundaries where a 500 is the
  right outcome.
- The codec is synchronous by construction — the client deserializes
  during render. A schema that resolves asynchronously (or a zod schema
  whose `transform`/`refine` throws — see limitation 4) makes the codec
  throw a `TypeError`, not silently `await` something render can't wait
  for.
- `deserialize`'s returned error type is `Out<DErr> | DecodeError` — a flat
  union, not a nested `{ domain } | { transport }` shape. Use one
  `matchError` for both.
- Reconstructing a domain error instance client-side requires
  `taggedErrorSchema` (or an equivalent Standard Schema) on the `err`
  branch — otherwise `deserialize`'s success value on that branch is a
  plain object, not the tagged class instance `matchError` expects.

## API

### `codec(schemas)`

```ts
interface CodecSchemas<SOk, SErr, DOk, DErr> {
    serialize: { ok: SOk; err: SErr };
    deserialize: { ok: DOk; err: DErr };
}

function codec<SOk, SErr, DOk, DErr>(
    schemas: CodecSchemas<SOk, SErr, DOk, DErr>,
): ResultCodec<SOk, SErr, DOk, DErr>;
```

Four type parameters because the shape on the wire does not have to match
the domain shape — see the `Date → string` example in the package's test
suite (`serialize usa il valore validato dello schema, non il dato di
dominio`). The two `serialize` schemas and the two `deserialize` schemas
can differ deliberately (e.g. deserialize is stricter than what a legacy
server used to send).

### `.serialize(result)` / `.serializeUnsafe(result)`

```ts
serialize(result: Result<In<SOk>, In<SErr>>): Result<IResult<Out<SOk>, Out<SErr>>, EncodeError>;
serializeUnsafe(result: Result<In<SOk>, In<SErr>>): IResult<Out<SOk>, Out<SErr>>;
```

Validates the active branch (`ok` or `err`) against the matching schema
and produces the flat envelope `{ success, data, error }` (`IResult` from
`@efesto-cloud/result`). On a schema mismatch, `serialize` returns
`Result.err(new EncodeError({ issues, branch }))`; `serializeUnsafe`
throws that `EncodeError`. See limitation 3 for a compiler gap on this
path.

### `.deserialize(input)` / `.deserializeUnsafe(input)`

```ts
deserialize(input: unknown): Result<Out<DOk>, Out<DErr> | DecodeError>;
deserializeUnsafe(input: unknown): Result<Out<DOk>, Out<DErr>>;
```

Never throws on malformed `input` — a non-object, a missing/non-boolean
`success`, an array, a hostile `Proxy`, a getter that throws, all become a
`DecodeError` with a `branch` of `"envelope" | "ok" | "err"` telling you
where the mismatch was. `deserializeUnsafe` throws only `DecodeError`
instances (via `DecodeError.is`); a domain failure still comes back as a
`Result.err(...)`, not a throw — the "unsafe" only applies to the
transport, not to the domain outcome.

One exception, and it is about your schema rather than the payload: if a
branch schema is a Zod schema that throws internally on the hostile value,
Zod turns that throw into a Promise and you get the deliberate `TypeError`
of limitation 4 instead of a `DecodeError`. Keep the codec's schemas free
of throwing transforms and this cannot happen.

### `EncodeError` / `DecodeError`

```ts
class EncodeError extends TaggedError("EncodeError")<{
    issues: readonly StandardSchemaV1.Issue[];
    branch: "ok" | "err";
}> {}

class DecodeError extends TaggedError("DecodeError")<{
    issues: readonly StandardSchemaV1.Issue[];
    branch: "envelope" | "ok" | "err";
}> {}
```

Both are `@efesto-cloud/tagged-error` classes — `_tag: "EncodeError"` /
`"DecodeError"`, usable in any `matchError`/`matchErrorPartial` alongside
domain errors. `DecodeError.is(x)` / `EncodeError.is(x)` are available as
plain tag guards.

## Known limitations

### 1. The inherited zod constraint

`result-codec` depends on `@efesto-cloud/result`, whose `dist/index.d.ts`
imports zod's types unconditionally (`import type { ZodError,
ZodSafeParseResult } from "zod"`), even though zod is only an *optional*
peer dependency of `result` — so it is not installed by default. A
consumer of `result-codec` that does not have zod among its own
dependencies will not compile without `skipLibCheck: true` in its
`tsconfig.json`. The real fix — moving `fromZod` to a dedicated
zod-specific export of `result` — is tracked but not done yet. Either add
`zod` as a dependency, or set `skipLibCheck: true`.

### 2. `taggedErrorSchema` validates the tag, not the props

`taggedErrorSchema` (see `@efesto-cloud/tagged-error`) checks that `_tag`
matches one of the given classes and then constructs `new Cls(value)` on
the raw object — it does not check that `value` actually carries the
props the class declares. A server that drifts out of sync with the
client and sends `{ _tag: "UserForbidden" }` without `motivo` still
decodes as a `Success` on the schema level: `deserialize` returns a real
`UserForbidden` instance whose `motivo` is `undefined` — despite being
typed `string` — and the component crashes three levels down
(`e.motivo.length`, say) instead of failing where the bad payload was
read. This is exactly the failure this package exists to catch, and it
passes through silently with the convenience helper. For a fully-checked
`err` branch, write that schema by hand instead of `taggedErrorSchema`:

```ts
import { z } from "zod";

const UserForbiddenWireSchema = z.object({
    _tag: z.literal("UserForbidden"),
    motivo: z.string(),
});
```

The package's own test suite has the worked example ("i props dell'errore
vengono validati, non solo il tag").

### 3. The `serialize` error union is not compiler-checked

`taggedErrorSchema`'s Standard Schema has `InferInput = unknown`, so
`schemas.serialize.err` accepts *any* value at the type level. Concretely:
add a new domain error class, forget to add it to the `err` schema passed
to `codec(...)`, and the call site still compiles — nothing in
`Result<Ok, DomainErrA | DomainErrB | NewError>` forces the codec's `err`
schema to know about `NewError`. The failure only shows up at runtime, as
an `EncodeError` from `serialize` (or a throw from `serializeUnsafe`, i.e.
a 500). This is asymmetric: the `ok` branch *is* checked by the compiler —
`serialize(Result.ok(wrongShape))` fails to typecheck if `wrongShape`
doesn't match `In<SOk>`. There is no automated safety net for the `err`
side today; when adding an error class, grep for the `codec(...)` calls
that serialize it.

### 4. A zod schema whose `transform`/`refine` can throw

The codec is synchronous by construction, but zod's Standard Schema
`validate()` converts *any* internal throw — not just genuine async
validation — into a Promise (its `safeParseAsync` fallback). The codec
can't tell "this schema is legitimately async" apart from "this
schema's `transform` threw", so both surface identically: a `TypeError`
from the synchronous validator (`serialize`/`serializeUnsafe`) or a
`DecodeError`-free throw from `deserialize`/`deserializeUnsafe`, with a
message that names both possibilities. Practical rule: don't write a
`transform`/`refine` in a codec schema that can throw. Prefer zod's
declarative validators — `z.url()` instead of
`.transform((s) => new URL(s))`, `.refine((v) => isValid(v))` (returning
`false`, not throwing) instead of a refinement that throws on invalid
input.

## Common Mistakes To Avoid

- Do not reach for `deserializeUnsafe` expecting it to throw on a domain
  failure — it only throws for `DecodeError` (a transport problem); a
  domain error still comes back as `Result.err(...)`.
- Do not use `taggedErrorSchema` when the `err` branch needs its props
  verified, not just its tag — see limitation 2.
- Do not write a `transform`/`refine` that throws in a codec schema — see
  limitation 4.
- Do not assume `serialize` catches a forgotten error class at compile
  time — see limitation 3.
- Do not deserialize with a *looser* schema than what `serialize` produced
  if you need a strict contract — the two directions are independent
  schema pairs on purpose (to allow, e.g., a stricter `deserialize` for a
  migration), but that also means nothing forces them to agree.

## Patterns

### One `matchError` for domain and transport

```ts
const decoded = userCodec.deserialize(loaderData);
if (decoded.isFailure()) {
    const status = matchError(decoded.error, {
        UserNotFound: () => 404,
        UserForbidden: () => 403,
        DecodeError: () => 502, // schema drift / corrupt payload
    });
}
```

### Round trip through `JSON.stringify`

```ts
const wire = JSON.parse(JSON.stringify(userCodec.serializeUnsafe(result)));
const decoded = userCodec.deserialize(wire);
```

This is the shape of an actual React Router loader → client hop: the
loader's return value is serialized by the framework, and the client
receives the plain JSON-parsed object as `loaderData`.

## Types

```ts
interface ResultCodec<SOk, SErr, DOk, DErr> {
    serialize(result: Result<In<SOk>, In<SErr>>): Result<IResult<Out<SOk>, Out<SErr>>, EncodeError>;
    serializeUnsafe(result: Result<In<SOk>, In<SErr>>): IResult<Out<SOk>, Out<SErr>>;
    deserialize(input: unknown): Result<Out<DOk>, Out<DErr> | DecodeError>;
    deserializeUnsafe(input: unknown): Result<Out<DOk>, Out<DErr>>;
}

// In<S>  = StandardSchemaV1.InferInput<S>
// Out<S> = StandardSchemaV1.InferOutput<S>
```
