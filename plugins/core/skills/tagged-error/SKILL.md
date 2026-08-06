---
name: tagged-error
description: Use when writing or reviewing code that defines or matches on tagged domain errors from the @efesto-cloud/tagged-error package, or when a domain error needs to survive a serialized boundary (a route loader/action response, a queue message).
argument-hint: "Paste the code snippet or use case and ask: 'add a tagged error for X' / 'normalize error matching'"
---

# Tagged Error

**Installation:** If not already installed, add the package with `pnpm add @efesto-cloud/tagged-error`.

Use this skill for domain errors discriminated by a literal `_tag`, with
an exhaustive `match`/`matchError` verified by the compiler. Reach for
this — instead of a plain `class Foo extends Error {}` + `.name` switch —
whenever the error needs to be reliably identified **after** crossing a
serialized boundary: a React Router loader/action response reaching the
client, a queue message, anything that goes through
`JSON.stringify`/`JSON.parse`. `.name`/`instanceof` checks work fine
in-process but do not survive that boundary as a *declared* contract;
`_tag` does, because it is literal string data by construction.

## Core Rules

- Define with `class Foo extends TaggedError("Foo")<{ field: string }> {}` — omit the type parameter for a tag with no props.
- Construct with `new Foo({ field, message?, cause? })`.
- Discriminate with `_tag`, never `.name` or `instanceof`, once the error may cross a serialized boundary.
- Collapse a union with `error.match({ ... })` (instance method) or `matchError(error, { ... })` (standalone, data-last) — both are exhaustive, verified by the compiler.
- Use `matchErrorPartial(error, { ..., otherwise })` only when a genuine default branch is intended, not to dodge a missing case.
- Rehydrate instances from a wire payload with `taggedErrorSchema(...classes)` — but it only checks `_tag`, not the declared props; see Common Mistakes below.
- `error.toJSON()` (and therefore `JSON.stringify`) preserves `_tag`, `name`, `message`, and every declared prop; `cause` is flattened recursively if it's an `Error` (stack omitted, circular chains guarded).

## Common Mistakes To Avoid

- Do not switch on `.name` or use `instanceof` once the error needs to reach a client component or cross the wire — the class identity does not survive serialization; `_tag` does.
- Do not treat `taggedErrorSchema` as a full contract check: it verifies the tag and constructs the instance, but does **not** validate that the payload carries the props the class declares. A payload missing a required prop still produces a `Success` with that prop `undefined`, despite being typed otherwise. For a fully-checked branch, write the schema by hand (e.g. zod: `z.object({ _tag: z.literal("Foo"), field: z.string() })`).
- Do not forget the `instanceof Promise` guard when consuming `taggedErrorSchema["~standard"].validate(...)` directly — the Standard Schema contract types `validate` as possibly async even though this schema is always synchronous.
- When the failure needs to cross the loader/action → client boundary as a `Result`, pair this with `@efesto-cloud/result-codec` rather than hand-rolling serialization — its `deserialize` returns a flat `DomainError | DecodeError` union so one `matchError` covers both domain and transport failures.

## Procedure

1. Identify the failure modes that need their own tag (one class per condition, same discipline as `references/errors.md`'s `DomainError` subclasses).
2. Define each with `class X extends TaggedError("X")<Props> {}`.
3. Build the union type (`type MyError = A | B | C`) at the function boundary that returns it.
4. Dispatch exhaustively with `matchError(err, { A: ..., B: ..., C: ... })` — let the compiler catch a missing case.
5. If the error needs to cross a serialized boundary, add its class to a `taggedErrorSchema(...)` on the receiving side (or write a stricter zod schema if the props must be verified too).

## Quick Patterns

```ts
class CartNotFound extends TaggedError("CartNotFound") {}
class OutOfStock extends TaggedError("OutOfStock")<{ sku: string }> {}

type CartError = CartNotFound | OutOfStock;

function toStatus(err: CartError): number {
    return matchError(err, {
        CartNotFound: () => 404,
        OutOfStock: () => 409,
    });
}
```

```ts
const ErrSchema = taggedErrorSchema(CartNotFound, OutOfStock);
const result = ErrSchema["~standard"].validate(payloadFromTheWire);
if (!(result instanceof Promise) && !result.issues) {
    result.value.match({
        CartNotFound: () => "empty",
        OutOfStock: (e) => `backorder: ${e.sku}`,
    });
}
```
