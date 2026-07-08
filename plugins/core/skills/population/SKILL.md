---
name: population
description: >
  Explain and scaffold the generic population (eager-loading) layer for a hexagonal architecture
  TypeScript project using @efesto-cloud/expand. This skill covers the Expand<T> spec format,
  NormalizedExpand<SHAPE>, normalizeExpand(), and the Shape type pattern — all DB-agnostic.
  Use this skill whenever the user needs to understand the population/eager-loading type system,
  design a Shape, or learn how Expand<T> works regardless of the database.
  Trigger when the user says things like "what is a Shape", "how does Expand<T> work",
  "explain the expand spec format", "I need to design the FooShape type",
  or whenever population/eager-loading concepts need to be introduced for the first time.
  For the concrete MongoDB implementation ($lookup, BaseExpander, QueryBuilder) use the
  @efesto-cloud/mongodb-expand package. For Prisma use @efesto-cloud/prisma-expand.
---

# Population (Expand) Skill

**Installation:** Add the core expand package:
- `pnpm add @efesto-cloud/expand`

Covers the DB-agnostic population (eager-loading) type system: the `Expand<T>` spec format,
`NormalizedExpand<SHAPE>`, `normalizeExpand()`, and the per-entity **Shape** type. These concepts
are shared by all DB-specific expand adapters.

**Next step:** Once the Shape type is designed, install the DB-specific runtime:
- MongoDB: `@efesto-cloud/mongodb-expand` (`BaseExpander`, `QueryBuilder`)
- Prisma: `@efesto-cloud/prisma-expand` (`BasePrismaExpander`)

---

## The Shape Type

A **Shape** is a pure TypeScript type that declares which fields of an entity can be
populated (eager-loaded). It lives alongside the repository at `src/repo/shape/FooShape.ts`.

```typescript
// src/repo/shape/FooShape.ts
import type { BazShape } from "./BazShape.js"; // only if Baz also has an expander

export type FooShape = {
    bar: true;       // leaf: Bar has no further expansion, or we never go deeper
    items: true;     // leaf: 1:many array, same rule
    baz: BazShape;   // nested: Baz itself is also expandable
};
```

**Rules:**
- Use `true` when the related entity has no expander of its own, or you never need to go deeper than one level.
- Use `RelatedShape` when the related entity already has (or will have) its own expander and callers might want to expand its fields too.
- Shape types contain no runtime logic — they are type-level declarations consumed by `normalizeExpand()`.

See `references/shape-example.ts` for annotated examples.

---

## `Expand<T>` — The User-Facing Spec

`Expand<T>` is the flexible input format callers use to request which fields to populate.
It accepts many equivalent forms:

```typescript
import type { Expand } from "@efesto-cloud/expand";
import type { FooShape } from "./shape/FooShape.js";

// All of the following are valid Expand<FooShape> values:

true                          // expand all fields with their defaults
'*'                           // expand all fields (same as true)
'bar'                         // expand only the bar field
['bar', 'items']              // expand bar and items
{ bar: true }                 // expand bar
{ bar: true, items: true }    // expand bar and items
{ baz: { nestedField: true } } // nested: expand baz and its nestedField
['bar', { baz: { nestedField: true } }]  // mixed array form
```

The exact definition of the type:

```typescript
export type Expand<T> =
    | true                                                   // expand all known fields
    | "*"                                                    // same as true
    | keyof T                                                // single field
    | (keyof T)[]                                            // array of fields
    | { [K in keyof T]?: Expand<T[K]> }                      // object with nested specs
    | (keyof T | { [K in keyof T]?: Expand<T[K]> })[];       // mixed array
```

The `Expand<T>` type is used in repository interface `Options` namespaces:

```typescript
namespace IFooRepo {
    export type Options = {
        expand?: Expand<FooShape>;
    };
}
```

---

## `NormalizedExpand<SHAPE>` — The Internal Format

After calling `normalizeExpand()`, all the flexible forms above collapse into a single
normalized object shape:

```typescript
import type { NormalizedExpand } from "@efesto-cloud/expand";

// NormalizedExpand<SHAPE> is defined as:
export type NormalizedExpand<SHAPE> = {
    [K in keyof SHAPE]?: SHAPE[K] extends true
        ? true
        : NormalizedExpand<SHAPE[K]>;
};

// So NormalizedExpand<FooShape> is always an object like:
{
    bar?: true;
    items?: true;
    baz?: NormalizedExpand<BazShape>;
}
```

This is the format consumed internally by `BaseExpander` (MongoDB) and `BasePrismaExpander`
(Prisma). You rarely need to work with it directly unless writing a custom DB adapter.

---

## `normalizeExpand(spec, shape)` — The Converter

```typescript
import { normalizeExpand } from "@efesto-cloud/expand";
import FooExpander from "../expand/FooExpander.js";
import type { FooShape } from "../shape/FooShape.js";

const normalized = normalizeExpand(spec, FooExpander.SHAPE);
// normalized is now NormalizedExpand<FooShape>
```

Signature:

```typescript
function normalizeExpand<T extends Record<string, unknown>>(
    spec: Expand<T> | Expand<T>[] | undefined,
    shape: T,
): NormalizedExpand<T>;
```

- `spec` — any `Expand<FooShape>` value, an array of them, or `undefined`
- `shape` — the static shape object (acts as a schema for which keys are valid)
- Returns — `NormalizedExpand<FooShape>` with only valid keys, `undefined` stripped

Behaviour:
- `undefined` → `{}` (nothing to expand).
- `true` / `'*'` → expand every key of the provided `shape`.
- `'field'` → `{ field: true }`.
- `['a', 'b']` → `{ a: true, b: true }`.
- Nested objects recurse.
- Mixed arrays are merged (later entries can deepen earlier ones).

---

## Reference Files

- `references/shape-example.ts` — Annotated Shape type patterns (leaf vs. nested)
