---
name: result-codec
description: Use when a Result<T, E> needs to cross a serialized boundary — a React Router loader/action response reaching the client, a queue message — and must be reconstructed as a typed, matchable Result rather than a plain object. From the @efesto-cloud/result-codec package.
argument-hint: "Paste the loader/action code and ask: 'serialize this Result for the client' / 'add a codec for X'"
---

# Result Codec

**Installation:** If not already installed, add the package with
`pnpm add @efesto-cloud/result-codec @efesto-cloud/result @efesto-cloud/tagged-error`
(plus `zod`, or another Standard Schema library, for the actual schemas).

Use this skill for the loader/action → client boundary: a `Result<T, E>`
produced server-side needs to become a plain JSON envelope, travel to the
client, and come back as a real `Result` whose error branch still
distinguishes domain failures from "the payload wasn't what we expected".
`references/monad-result.md`'s `toObject`/`fromObject` only round-trips
the shape; this package validates it and, paired with
`@efesto-cloud/tagged-error`, rehydrates concrete error instances so
`matchError` works identically on both ends.

## Core Rules

- Build a codec with `codec({ serialize: { ok, err }, deserialize: { ok, err } })` — four Standard Schema validators (one per branch, per direction).
- `serialize(result)` / `deserialize(input)` never throw on bad *data* — they return a `Result`. Use `serializeUnsafe`/`deserializeUnsafe` only at a boundary where a throw (500) is the right outcome for a schema mismatch.
- `deserialize`'s error type is `Out<DErr> | DecodeError` — a flat union. Handle both with **one** `matchError`, not a separate transport-error branch.
- The codec is synchronous by construction (the client deserializes during render) — an async schema, or a zod schema whose `transform`/`refine` throws, makes it throw a `TypeError` instead of silently waiting.
- Use `taggedErrorSchema(...)` on the `err` branch to get real class instances back client-side, not plain objects — see the `tagged-error` skill for its own known limitation (tag-only validation).

## Common Mistakes To Avoid

- Do not expect `deserializeUnsafe` to throw on a domain failure — it only throws for `DecodeError` (transport); a domain error still comes back as `Result.err(...)`.
- Do not assume the compiler catches a forgotten error class on the `serialize` side: `taggedErrorSchema`'s `InferInput` is `unknown`, so adding a domain error and forgetting to add it to the codec's `err` schema still compiles — it only fails at runtime as an `EncodeError`. The `ok` branch, by contrast, is genuinely type-checked.
- Do not write a `transform`/`refine` that can throw in a codec schema — prefer declarative validators (`z.url()`, `.refine()` returning `false`).
- Do not skip installing zod if a schema needs it: `result-codec` depends on `@efesto-cloud/result`, whose `.d.ts` imports zod's types unconditionally even though zod is an optional peer — without it, `skipLibCheck: true` is required to compile.
- Do not send a plain `DomainError` (from `references/errors.md`) across this boundary and match on `.name` client-side — use `@efesto-cloud/tagged-error` classes for anything that needs to survive serialization.

## Procedure

1. Define the domain errors as `TaggedError` classes (see the `tagged-error` skill).
2. Pick or write Standard Schemas for the `ok` shape and for the `err` shape (`taggedErrorSchema(...)` for a quick tag-only check, a hand-written schema when props must be verified too).
3. Build the codec: `codec({ serialize: { ok, err }, deserialize: { ok, err } })`.
4. Server side: `return codec.serializeUnsafe(result);` from the loader/action.
5. Client side: `const decoded = codec.deserialize(loaderData);` then `matchError(decoded.error, { ...domain tags..., DecodeError: ... })` when `decoded.isFailure()`.

## Quick Patterns

```ts
const userCodec = codec({
    serialize: { ok: UserSchema, err: UserErrSchema },
    deserialize: { ok: UserSchema, err: UserErrSchema },
});

// server (loader)
return userCodec.serializeUnsafe(result);

// client
const decoded = userCodec.deserialize(loaderData);
if (decoded.isFailure()) {
    return matchError(decoded.error, {
        UserNotFound: () => 404,
        UserForbidden: () => 403,
        DecodeError: () => 502, // schema drift, corrupt payload, …
    });
}
```
