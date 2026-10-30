# Tagged errors (`@efesto-cloud/tagged-error`)

Domain errors discriminated by a literal `_tag`, with an exhaustive
`match`/`matchError` verified by the compiler, and a Standard Schema
(`taggedErrorSchema`) that rehydrates concrete instances from a wire
payload. The tool for the case `references/errors.md`'s local
`DomainError` pattern does not cover: a failure that has to survive a
serialized boundary — a React Router loader/action response sent to the
client, a queue message — and still be handled with the same
compiler-checked exhaustiveness on both sides.

## The constructor

```ts
import { TaggedError } from "@efesto-cloud/tagged-error";

class CartNotFound extends TaggedError("CartNotFound") {}
class OutOfStock extends TaggedError("OutOfStock")<{ sku: string }> {}

const e = new OutOfStock({ sku: "ABC-1" });
e._tag;   // "OutOfStock"
e.name;   // "OutOfStock"
e.sku;    // "ABC-1"
e instanceof Error; // true
```

`TaggedError(tag)` returns a class to extend. The type parameter declares
the props (omit it for a tag with no data). `message` and `cause` are
accepted alongside the declared props and forwarded to `Error`.

## Why `_tag`, not `.name` or `instanceof`

`references/errors.md`'s `DomainError.name = new.target.name` pattern is
reliable **within the same process** — a route loader switching on
`result.error.name` right after calling a use case sees the real object,
not a serialized copy. It stops being reliable the moment the error needs
to reach the client as data: a plain `JSON.stringify`/`JSON.parse` round
trip (or a framework's own error-serialization boundary) drops the
prototype chain — `instanceof` is gone — and whether any given property
survives depends on incidental details of how that property was assigned,
not on a declared contract. `_tag` sidesteps this because it is declared
as literal string **data** by construction, not recovered from class
identity — see `references/errors.md`'s "Why this pattern over Zod /
typed-errors libs" for when to reach for one over the other.

## Exhaustive matching

```ts
import { matchError } from "@efesto-cloud/tagged-error";

type CartError = CartNotFound | OutOfStock;

function toStatus(err: CartError): number {
    return matchError(err, {
        CartNotFound: () => 404,
        OutOfStock: () => 409,
    });
}
```

`matchError(error, handlers)` (data-last, standalone) and
`error.match(handlers)` (instance method) are identical in behaviour.
Both require a handler for every member of the error union — a missing or
misspelled tag is a compile error, not a runtime `TypeError`. Use
`matchErrorPartial(error, { ..., otherwise })` when only some tags are
handled explicitly.

## Rehydrating instances: `taggedErrorSchema`

```ts
import { taggedErrorSchema } from "@efesto-cloud/tagged-error";

const ErrSchema = taggedErrorSchema(CartNotFound, OutOfStock);
// StandardSchemaV1<unknown, CartNotFound | OutOfStock>

const result = ErrSchema["~standard"].validate(payloadFromTheWire);
if (!(result instanceof Promise) && !result.issues) {
    result.value instanceof OutOfStock; // true, if the tag matched
}
```

Recognises `_tag`, looks up the matching class, and constructs
`new Cls(value)` on the raw object.

**Known limitation — validates the tag, not the props.**
`taggedErrorSchema` does not check that the payload actually carries the
props the class declares. `{ _tag: "OutOfStock" }` with no `sku` still
produces a `Success` whose `.value` is a real `OutOfStock` instance with
`sku: undefined`, despite `sku` being typed `string` — the mismatch
surfaces later, wherever the code trusts the type. For a fully-checked
`err` branch, write that schema by hand (e.g. with zod:
`z.object({ _tag: z.literal("OutOfStock"), sku: z.string() })`) instead of
`taggedErrorSchema`.

## Anti-patterns

- **Switching on `.name` or `instanceof` past a serialized boundary.**
  Works in-process; breaks once the error crosses the wire. Use `_tag`.
- **Trusting `taggedErrorSchema` as a full contract check.** It verifies
  the tag, not the declared props — see the limitation above.
- **Falling back to `matchErrorPartial`'s `otherwise` to avoid handling a
  case.** `matchError`'s whole point is compiler-verified exhaustiveness;
  use `matchErrorPartial` only when a genuine default branch is intended.

## Cross-layer where it shows up

- **Within one process** (a use case's own error union, a route loader
  branching on the use case's `Result` before responding): the local
  `DomainError` pattern from `references/errors.md` is enough — no
  serialization involved.
- **At the loader/action → client boundary**: use `TaggedError` for the
  domain errors and `@efesto-cloud/result-codec` to carry the `Result`
  across — see `references/result-codec.md`. `matchError` then covers
  both "the domain said no" and "the payload wasn't what was expected"
  (`DecodeError`) with one exhaustive switch.

## Quick reference

```ts
// Define
class Foo extends TaggedError("Foo")<{ field: string }> {}

// Construct
new Foo({ field: "x", message: "opzionale", cause: someError });

// Guard
Foo.is(x); // type guard on _tag

// Dispatch
err.match({ Foo: (e) => ... });
matchError(err, { Foo: (e) => ... });
matchErrorPartial(err, { Foo: (e) => ..., otherwise: (e) => ... });

// Rehydrate from a wire payload
const schema = taggedErrorSchema(Foo, Bar);
const result = schema["~standard"].validate(payload);
if (!(result instanceof Promise) && !result.issues) result.value; // Foo | Bar
```
