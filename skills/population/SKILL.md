---
name: population
description: >
  Explain and scaffold the generic population (eager-loading) layer for a hexagonal architecture
  TypeScript project using @efesto-cloud/population. This skill covers the Populate<T> spec format,
  NormalizedPopulate<T>, normalizePopulate(), and the Shape type pattern — all DB-agnostic.
  Use this skill whenever the user needs to understand the population type system, design a Shape,
  or learn how Populate<T> works regardless of the database.
  Trigger when the user says things like "what is a Shape", "how does Populate<T> work",
  "explain the population spec format", "I need to design the FooShape type",
  or whenever population concepts need to be introduced for the first time.
  For the concrete MongoDB implementation ($lookup, BasePopulator, QueryBuilder) use the
  mongodb-population skill. For Prisma use the prisma-population skill.
---

# Population Skill

**Installation:** Add the core population package:
- `pnpm add @efesto-cloud/population`

Covers the DB-agnostic population type system: the `Populate<T>` spec format, `NormalizedPopulate<T>`,
`normalizePopulate()`, and the per-entity **Shape** type. These concepts are shared by all
DB-specific population skills.

**Next step:** Once the Shape type is designed, install the DB-specific skill:
- MongoDB: `mongodb-population` skill
- Prisma: `prisma-population` skill

---

## The Shape Type

A **Shape** is a pure TypeScript type that declares which fields of an entity can be
populated (eager-loaded). It lives alongside the repository at `src/repo/shape/FooShape.ts`.

```typescript
// src/repo/shape/FooShape.ts
import type { BarShape } from "./BarShape.js"; // only if Bar also has a populator

export type FooShape = {
    bar: true;       // leaf: Bar has no further population, or we never go deeper
    items: true;     // leaf: 1:many array, same rule
    baz: BazShape;   // nested: Baz itself is also populatable
};
```

**Rules:**
- Use `true` when the related entity has no populator of its own, or you never need to go deeper than one level.
- Use `RelatedShape` when the related entity already has (or will have) its own populator and callers might want to populate its fields too.
- Shape types contain no runtime logic — they are type-level declarations consumed by `normalizePopulate()`.

See `references/shape-example.ts` for annotated examples.

---

## `Populate<T>` — The User-Facing Spec

`Populate<T>` is the flexible input format callers use to request which fields to populate.
It accepts many equivalent forms:

```typescript
import type { Populate } from "@efesto-cloud/population";
import type { FooShape } from "./shape/FooShape.js";

// All of the following are valid Populate<FooShape> values:

true                          // populate all fields with their defaults
'*'                           // populate all fields (same as true)
'bar'                         // populate only the bar field
['bar', 'items']              // populate bar and items
{ bar: true }                 // populate bar
{ bar: true, items: true }    // populate bar and items
{ baz: { nestedField: true } } // nested: populate baz and its nestedField
['bar', { baz: { nestedField: true } }]  // mixed array form
```

The `Populate<T>` type is used in repository interface `Options` namespaces:

```typescript
namespace IFooRepo {
    export type Options = {
        populate?: Populate<FooShape>;
    };
}
```

---

## `NormalizedPopulate<T>` — The Internal Format

After calling `normalizePopulate()`, all the flexible forms above collapse into a single
normalized object shape:

```typescript
import type { NormalizedPopulate } from "@efesto-cloud/population";

// NormalizedPopulate<FooShape> is always an object like:
{
    bar?: true | NormalizedPopulate<true>;
    items?: true | NormalizedPopulate<true>;
    baz?: true | NormalizedPopulate<BazShape>;
}
```

This is the format consumed internally by `BasePopulator` (MongoDB) and `BasePrismaPopulator`
(Prisma). You rarely need to work with it directly unless writing a custom DB adapter.

---

## `normalizePopulate(spec, shape)` — The Converter

```typescript
import { normalizePopulate } from "@efesto-cloud/population";
import FooPopulator from "../populate/FooPopulator.js";
import type { FooShape } from "../shape/FooShape.js";

const normalized = normalizePopulate(spec, FooPopulator.SHAPE);
// normalized is now NormalizedPopulate<FooShape>
```

- `spec` — any `Populate<FooShape>` value (or `undefined`)
- `shape` — the static shape object (acts as a schema for which keys are valid)
- Returns — `NormalizedPopulate<FooShape>` with only valid keys, `undefined` stripped

---

## Reference Files

- `references/shape-example.ts` — Annotated Shape type patterns (leaf vs. nested)
