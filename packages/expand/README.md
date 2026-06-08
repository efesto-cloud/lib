# @efesto-cloud/expand

Database-agnostic types and a normalizer for expressing **eager-loading specs** ("expand these related entities when fetching"). The MongoDB-specific runtime lives in [`@efesto-cloud/mongodb-expand`](../mongodb-expand).

## Installation

```bash
pnpm add @efesto-cloud/expand
```

## What's in the box

- `Expand<T>` — the user-facing expand spec type. Accepts every convenient shape.
- `NormalizedExpand<SHAPE>` — the standardized object representation expanders consume.
- `normalizeExpand(spec, shape)` — collapse any `Expand<T>` variant into the normalized form.

## The `Expand<T>` spec

A single, recursive type that accepts every sensible way to ask for expanded fields:

```ts
type Expand<T> =
    | true                                                   // expand all known fields
    | "*"                                                    // same as true
    | keyof T                                                // single field
    | (keyof T)[]                                            // array of fields
    | { [K in keyof T]?: Expand<T[K]> }                      // object with nested specs
    | (keyof T | { [K in keyof T]?: Expand<T[K]> })[];       // mixed array
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

## `normalizeExpand(spec, shape)`

Collapse any user-provided spec into the canonical object form that expanders consume.

```ts
import { normalizeExpand, type Expand } from "@efesto-cloud/expand";

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

const spec: Expand<PostShape> = ["author", { comments: { author: true } }];
const normalized = normalizeExpand(spec, SHAPE);
// → { author: true, comments: { author: true } }
```

Behaviour:

- `undefined` → `{}` (nothing to expand).
- `true` / `"*"` → expand every key of the provided `shape`.
- `"field"` → `{ field: true }`.
- `["a", "b"]` → `{ a: true, b: true }`.
- Nested objects recurse.
- Mixed arrays are merged (later entries can deepen earlier ones).

## Shape types

Expanders declare a `Shape` that describes which fields are expandable:

```ts
// Leaf fields use `true`; fields whose related entity is also expandable
// use that entity's own Shape type.
export type PostShape = {
    author: true;             // leaf (Author has no expander)
    comments: CommentShape;   // nested (Comment has an expander)
};
```

## Using this package

Most consumers won't import `@efesto-cloud/expand` directly — they'll import it transitively through `@efesto-cloud/mongodb-expand` (or another adapter) when writing an `Expander` and `QueryBuilder` for a specific repository.

## Related

- [`@efesto-cloud/mongodb-expand`](../mongodb-expand) — MongoDB runtime (`BaseExpander`, `QueryBuilder`).
- [`@efesto-cloud/prisma-expand`](../prisma-expand) — Prisma runtime (`BasePrismaExpander`).
