# The loader/action boundary (`@efesto-cloud/result-codec`)

A codec for `Result<T, E>` values that cross a serialized boundary — the
React Router loader/action → client hop, a queue message, anything that
goes through `JSON.stringify`/`JSON.parse`. This is the tool for what
`references/monad-result.md`'s "Serialisation" section only sketches
(`toObject`/`fromObject`): reconstructing a **typed, matchable** `Result`
on the other side, not just a plain object.

Validates with one [Standard Schema](https://standardschema.dev) per
branch (`ok` / `err`) per direction (`serialize` / `deserialize`) — four
schemas total. `deserialize`'s error union is `DecodeError | <domain
errors>`, flattened side by side, so one `matchError` (see
`references/tagged-error.md`) covers "the domain said no" and "the payload
wasn't what was expected" together.

## Setup

```ts
import { codec } from "@efesto-cloud/result-codec";
import { TaggedError, taggedErrorSchema } from "@efesto-cloud/tagged-error";
import { z } from "zod";

class UserNotFound extends TaggedError("UserNotFound") {}
class UserForbidden extends TaggedError("UserForbidden")<{ motivo: string }> {}

const UserSchema = z.object({ id: z.string(), nome: z.string() });
const UserErrSchema = taggedErrorSchema(UserNotFound, UserForbidden);

const userCodec = codec({
    serialize: { ok: UserSchema, err: UserErrSchema },
    deserialize: { ok: UserSchema, err: UserErrSchema },
});
```

## Server side: the loader

```ts
export async function loader() {
    const result = await getUser(); // Result<UserDto, UserNotFound | UserForbidden>
    return userCodec.serializeUnsafe(result); // IResult<...> — plain, JSON-safe
}
```

`serializeUnsafe` throws `EncodeError` on a schema mismatch (a 500,
appropriate at this boundary); `serialize` returns
`Result<_, EncodeError>` when the caller wants to handle it instead.

## Client side: one `matchError` for domain and transport

```ts
import { matchError } from "@efesto-cloud/tagged-error";

function handle(loaderData: unknown) {
    const decoded = userCodec.deserialize(loaderData);
    if (decoded.isFailure()) {
        // decoded.error : UserNotFound | UserForbidden | DecodeError
        return matchError(decoded.error, {
            UserNotFound: () => 404,
            UserForbidden: () => 403,
            DecodeError: () => 502, // schema drift, corrupt payload, …
        });
    }
    return 200;
}
```

No separate `try`/`catch` or ad-hoc shape-checking layer: a schema-version
mismatch between server and client shows up as a `DecodeError` tag, in the
same match as the domain outcomes.

## Known limitations — read before relying on this

1. **The inherited zod constraint.** `result-codec` depends on
   `@efesto-cloud/result`, whose `dist/index.d.ts` imports zod's types
   unconditionally even though zod is only an optional peer dependency —
   a consumer without zod installed needs `skipLibCheck: true`.
2. **`taggedErrorSchema` validates the tag, not the props** — see
   `references/tagged-error.md`. Write the `err` schema by hand (zod) when
   the contract needs the props checked too.
3. **The `serialize` error union is not compiler-checked.** Adding a
   domain error class and forgetting to add it to the codec's `err`
   schema still compiles — `taggedErrorSchema`'s `InferInput` is
   `unknown`. The gap only shows up at runtime as an `EncodeError` (or a
   throw from `serializeUnsafe`). The `ok` branch, by contrast, is really
   type-checked.
4. **A schema `transform`/`refine` that throws breaks the sync contract.**
   The codec is synchronous by construction (the client deserializes
   during render); zod converts *any* internal throw into a Promise, so a
   throwing `transform` looks identical to a genuinely async schema and
   produces a `TypeError`. Prefer declarative validators
   (`z.url()`, `.refine()` returning `false`) over a `transform` that can
   throw.

Full detail and worked examples for all four:
`packages/result-codec/README.md`.

## Anti-patterns

- **Expecting `deserializeUnsafe` to throw on a domain failure.** It only
  throws for `DecodeError` (transport); a domain error still comes back as
  `Result.err(...)`.
- **Sending a `DomainError` (from `references/errors.md`) across this
  boundary and matching on `.name` client-side.** Use `TaggedError` +
  `_tag` for anything that has to cross — see `references/tagged-error.md`.

## Quick reference

```ts
const c = codec({
    serialize: { ok: SOk, err: SErr },
    deserialize: { ok: DOk, err: DErr },
});

c.serialize(result);        // Result<IResult<...>, EncodeError>
c.serializeUnsafe(result);  // IResult<...>, throws EncodeError

c.deserialize(input);       // Result<Out<DOk>, Out<DErr> | DecodeError>
c.deserializeUnsafe(input); // Result<Out<DOk>, Out<DErr>>, throws only DecodeError
```
