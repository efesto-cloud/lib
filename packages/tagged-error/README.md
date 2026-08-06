# @efesto-cloud/tagged-error

Domain errors with a discriminant `_tag`, an exhaustive `match` verified by
the compiler, and a Standard Schema that rehydrates concrete instances from
a wire payload.

## Installation

```bash
pnpm add @efesto-cloud/tagged-error
```

## Quick Start

```ts
import { TaggedError, matchError } from "@efesto-cloud/tagged-error";

class CartNotFound extends TaggedError("CartNotFound") {}
class OutOfStock extends TaggedError("OutOfStock")<{ sku: string }> {}

type CartError = CartNotFound | OutOfStock;

function findCart(id: string): CartError | { id: string; total: number } {
    if (id === "missing") return new CartNotFound();
    if (id === "empty") return new OutOfStock({ sku: "ABC-1" });
    return { id, total: 42 };
}

const outcome = findCart("empty");
if ("_tag" in outcome) {
    const message = matchError(outcome, {
        CartNotFound: () => "carrello non trovato",
        OutOfStock: (e) => `esaurito: ${e.sku}`,
    });
    console.log(message);
}
```

`TaggedError(tag)` returns a class. Extend it and declare the props as a
type parameter — `TaggedError("OutOfStock")<{ sku: string }>` — or omit the
type parameter entirely for a tag with no data.

## Core Rules

- Build a tagged error class with `class Foo extends TaggedError("Foo")<Props> {}`.
  The tag is a string literal, carried both on the instance (`_tag`) and on
  the class (`Foo._tag`).
- Construct with `new Foo(props)` — `props` also accepts `message` and
  `cause` (both forwarded to `Error`), and is optional when `Props` is `{}`.
- Discriminate with `_tag`, not `instanceof` or `.name` — `_tag` is the one
  property guaranteed to survive `JSON.stringify`/`JSON.parse` as *data*,
  independent of any implementation detail of how the class assigns its own
  properties.
- Collapse a union with `error.match({ ... })` (instance method) or
  `matchError(error, { ... })` (standalone, data-last, works on
  `AnyTaggedError`). Both require a handler for every tag — the compiler
  rejects a call with a missing or misspelled key.
- Use `matchErrorPartial(error, { ..., otherwise })` when only some tags are
  handled explicitly.
- Reconstruct instances from a wire payload with
  `taggedErrorSchema(...classes)` — see the caveat in the API section below.

## API

### `TaggedError(tag)`

```ts
class Foo extends TaggedError("Foo")<{ field: string }> {}

const f = new Foo({ field: "x", message: "opzionale", cause: someError });
f._tag;      // "Foo"
f.name;      // "Foo"
f.field;     // "x"
f instanceof Error;      // true
Foo._tag;                // "Foo" (on the class)
Foo.is(f);                // true — type guard on _tag, not on prototype
```

- `message` and `cause` are the only reserved prop names shared with
  `Error`; `_tag`, `name`, and `stack` are also reserved and silently
  ignored if present in `props` — a payload from `JSON.parse` cannot spoof
  them, and cannot pollute the instance's prototype via `__proto__` either.
- `toJSON()` emits `_tag`, `name`, `message`, and every declared prop. If
  `cause` is set and is itself an `Error`, it is flattened recursively into
  plain data (`name`/`message`/props, `stack` omitted, circular chains
  guarded) — otherwise a bare `Error` serializes to `{}` because `name`,
  `message`, and `stack` are non-enumerable on the built-in prototype.

### `AnyTaggedError`

```ts
type AnyTaggedError = Error & { readonly _tag: string };
```

The loosest type that still has a tag. Useful for a catch-all parameter
before narrowing.

### `.match(handlers)` / `matchError(error, handlers)`

```ts
type CartError = CartNotFound | OutOfStock;

// instance method
(err as CartError).match({
    CartNotFound: () => "no cart",
    OutOfStock: (e) => `sku ${e.sku}`,
});

// standalone, data-last — identical dispatch
matchError(err as CartError, {
    CartNotFound: () => "no cart",
    OutOfStock: (e) => e.sku,
});
```

Both are exhaustive: the handler object's type is
`Record<Self["_tag"], (error) => R> & Record<Exclude<keyof H, Self["_tag"]>, never>`,
so a missing tag or an extra key fails to typecheck. At runtime, a tag with
no handler throws a `TypeError` naming the tag — this only happens when the
static type was widened (e.g. to `AnyTaggedError`) and the compiler could
not verify exhaustiveness.

### `matchErrorPartial(error, handlers)`

```ts
matchErrorPartial(err, {
    OutOfStock: (e) => e.sku,
    otherwise: (e) => `unhandled: ${e._tag}`,
});
```

`otherwise` is required; every other key is optional. The specific handler
wins over `otherwise` when both would apply.

### `taggedErrorSchema(...classes)`

```ts
import { taggedErrorSchema } from "@efesto-cloud/tagged-error";

const ErrSchema = taggedErrorSchema(CartNotFound, OutOfStock);
// StandardSchemaV1<unknown, CartNotFound | OutOfStock>

const result = ErrSchema["~standard"].validate(wirePayload);
// `validate` is typed to allow an async result (the Standard Schema
// contract); `taggedErrorSchema`'s is always synchronous, but the type
// still requires the guard.
if (!(result instanceof Promise) && !result.issues) {
    result.value instanceof OutOfStock; // true, if wirePayload._tag === "OutOfStock"
}
```

Recognizes `_tag` on the input, looks up the matching class, and
constructs `new Cls(value)` — the constructed instance passes `instanceof`
and has a working `.match()`. Duplicate tags among the classes passed in
throw a `TypeError` at schema-construction time, not per validation.

**Known limitation — validates the tag, not the props.** `taggedErrorSchema`
only checks that `_tag` is a string matching one of the given classes; it
does not check that the payload actually carries the props the class
declares. A payload `{ _tag: "OutOfStock" }` missing `sku` still produces a
`Success` whose `.value` is a real `OutOfStock` instance with `sku:
undefined` — even though `sku` is typed `string`. That mismatch surfaces
later, wherever the code trusts the type (`e.sku.toUpperCase()` throws).
If the contract needs the props verified too, write the schema for that
branch by hand instead — e.g. with zod:

```ts
import { z } from "zod";

const OutOfStockWireSchema = z.object({
    _tag: z.literal("OutOfStock"),
    sku: z.string(),
});
```

`@efesto-cloud/result-codec`'s test suite has a worked example of this
("i props dell'errore vengono validati, non solo il tag").

## Common Mistakes To Avoid

- Do not discriminate on `.name` or `instanceof` once the error may cross a
  serialized boundary (an HTTP response, a queue message). `instanceof`
  never survives `JSON.parse` — you get a plain object, not a class
  instance. Use `_tag`.
- Do not treat `taggedErrorSchema` as a full contract check — see the
  limitation above.
- Do not omit a case from `matchError`/`match` and reach for `otherwise` to
  paper over it — that's what `matchErrorPartial` is for; `matchError`'s
  whole point is compiler-verified exhaustiveness.
- Do not put secrets or large objects in `cause` if the error will be
  `toJSON()`'d to the client — `cause` is flattened and included.

## Patterns

### Exhaustive dispatch at the route boundary

```ts
const status = matchError(domainError, {
    CartNotFound: () => 404,
    OutOfStock: () => 409,
});
```

Adding a new error class to the domain union and forgetting to add a case
here is a compile error, not a runtime surprise.

### Rehydrating errors on the client

```ts
const ErrSchema = taggedErrorSchema(CartNotFound, OutOfStock);
const result = ErrSchema["~standard"].validate(await response.json());
if (!(result instanceof Promise) && !result.issues) {
    // result.value is a real CartNotFound | OutOfStock instance
    result.value.match({
        CartNotFound: () => "empty",
        OutOfStock: (e) => `backorder: ${e.sku}`,
    });
}
```

For the full round trip — serializing a `Result` on the server and
deserializing it on the client with one schema pair — see
[`@efesto-cloud/result-codec`](../result-codec).

## Types

```ts
type AnyTaggedError = Error & { readonly _tag: string };

type TagHandlers<Self extends { readonly _tag: string }, R> = {
    [K in Self["_tag"]]: (error: Extract<Self, { readonly _tag: K }>) => R;
};

type PartialTagHandlers<Self extends { readonly _tag: string }> =
    Partial<TagHandlers<Self, unknown>> & { otherwise: (error: Self) => unknown };
```
