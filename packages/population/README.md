# @efesto-cloud/population

Database-agnostic types and a normalizer for expressing **eager-loading specs** ("populate these related entities when fetching"). The MongoDB-specific runtime lives in [`@efesto-cloud/mongodb-population`](../mongodb-population).

## Installation

```bash
pnpm add @efesto-cloud/population
```

## What's in the box

- `Populate<T>` — the user-facing populate spec type. Accepts every convenient shape.
- `NormalizedPopulate<SHAPE>` — the standardized object representation populators consume.
- `normalizePopulate(spec, shape)` — collapse any `Populate<T>` variant into the normalized form.

## The `Populate<T>` spec

A single, recursive type that accepts every sensible way to ask for populated fields:

```ts
type Populate<T> =
    | true                                                   // populate all known fields
    | "*"                                                    // same as true
    | keyof T                                                // single field
    | (keyof T)[]                                            // array of fields
    | { [K in keyof T]?: Populate<T[K]> }                    // object with nested specs
    | (keyof T | { [K in keyof T]?: Populate<T[K]> })[];     // mixed array
```

### Examples

```ts
// All formats below resolve to { bar: true } after normalization.
"bar"
["bar"]
{ bar: true }

// Nested
{ baz: { qux: true } }

// Mixed
["bar", { baz: { qux: true } }]

// Everything
true
"*"
```

## `normalizePopulate(spec, shape)`

Collapse any user-provided spec into the canonical object form that populators consume.

```ts
import { normalizePopulate, type Populate } from "@efesto-cloud/population";

type PostShape = {
    author: true;
    comments: {
        author: true;
    };
};

const SHAPE: PostShape = {
    author: true,
    comments: { author: true },
};

const spec: Populate<PostShape> = ["author", { comments: { author: true } }];
const normalized = normalizePopulate(spec, SHAPE);
// → { author: true, comments: { author: true } }
```

Behaviour:

- `undefined` → `{}` (nothing to populate).
- `true` / `"*"` → expand every key of the provided `shape`.
- `"field"` → `{ field: true }`.
- `["a", "b"]` → `{ a: true, b: true }`.
- Nested objects recurse.
- Mixed arrays are merged (later entries can deepen earlier ones).

## Shape types

Populators declare a `Shape` that describes which fields are populatable:

```ts
// Leaf fields use `true`; fields whose related entity is also populatable
// use that entity's own Shape type.
export type PostShape = {
    author: true;             // leaf (Author has no populator)
    comments: CommentShape;   // nested (Comment has a populator)
};
```

## Using this package

Most consumers won't import `@efesto-cloud/population` directly — they'll import it transitively through `@efesto-cloud/mongodb-population` (or another adapter) when writing a `Populator` and `QueryBuilder` for a specific repository.

See the `/population` skill (`.claude/skills/population`) for the end-to-end recipe of adding population support to an entity: Shape, Populator, QueryBuilder, and the patches to entity, DTO, document, mapper, and repository.

## Related

- [`@efesto-cloud/mongodb-population`](../mongodb-population) — MongoDB runtime (`BasePopulator`, `QueryBuilder`).
