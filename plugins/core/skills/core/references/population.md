# Population (generic)

Eager-loading of related entities. This file covers the DB-agnostic
type system from `@efesto-cloud/population` —  the `Populate<T>` spec
format, `NormalizedPopulate<T>`, and the **Shape** type. For the
Prisma-specific implementation see `references/prisma-population.md`.

Population is optional. Many repos don't need it. Add it when a use
case wants to load `Foo` plus its `bars` in one round-trip without
issuing separate queries.

## The Shape type

A Shape is a pure TypeScript type declaring which fields of an entity
**can** be populated. Lives at
`core/src/repo/shape/FooShape.ts` (or in the adapter, depending on
where the populator lives).

```ts
// core/src/repo/shape/FooShape.ts
import type { BazShape } from "./BazShape.js";  // only if Baz itself has a populator

export type FooShape = {
    bar: true;         // leaf: Bar has no further population, or we don't go deeper
    items: true;       // leaf: 1:many array, same rule
    baz: BazShape;     // nested: Baz itself is also populatable
};
```

Rules:

- **`true`** when the related entity has no populator of its own, or
  you intentionally don't allow callers to drill into its sub-
  relations.
- **`RelatedShape`** when the related entity has (or will have) its
  own populator and callers might want to populate its sub-fields.
- **Shape types have no runtime presence.** They're compile-time
  declarations consumed by `normalizePopulate()` and by the
  populator's `toPrismaInclude` / `$lookup` logic.

A shape is the schema for what's loadable. The caller's spec
(`Populate<FooShape>`) is what they actually request.

## `Populate<T>` — the user-facing spec

`Populate<T>` is the flexible input format callers pass to repo
methods. It accepts many equivalent forms:

```ts
import type { Populate } from "@efesto-cloud/population";
import type { FooShape } from "./shape/FooShape.js";

// All of these are valid Populate<FooShape>:

true                                    // populate everything (default depth)
"*"                                     // same as true
"bar"                                   // populate just bar
["bar", "items"]                        // populate bar and items
{ bar: true }                           // populate bar
{ bar: true, items: true }              // populate bar and items
{ baz: { nestedField: true } }          // nested: populate baz + its nested
["bar", { baz: { nestedField: true } }] // mixed array form
```

The repo interface exposes this:

```ts
import type { Populate } from "@efesto-cloud/population";
import type { FooShape } from "./shape/FooShape.js";

interface IFooRepository {
    findById(id: string, options?: IFooRepository.Options): Promise<Foo | null>;
    list(filter, options?: IFooRepository.Options): Promise<{ items: Foo[]; total: number }>;
    save(foo: Foo): Promise<void>;
}

export namespace IFooRepository {
    export type Options = {
        populate?: Populate<FooShape>;
    };
}
```

The flexibility matters because callers have different needs:

- A simple route loader just wants `populate: true` to mean "give me
  everything reasonable".
- A targeted use case wants `populate: { baz: { nestedField: true } }`
  to fetch only one branch.

## `NormalizedPopulate<T>` — the internal format

`normalizePopulate(spec, shape)` collapses every form above into a
single canonical shape:

```ts
import type { NormalizedPopulate } from "@efesto-cloud/population";

// NormalizedPopulate<FooShape> is always:
{
    bar?: true | NormalizedPopulate<true>;
    items?: true | NormalizedPopulate<true>;
    baz?: true | NormalizedPopulate<BazShape>;
}
```

You rarely work with `NormalizedPopulate` directly — the populator's
base class consumes it.

## `normalizePopulate(spec, shape)` — the converter

```ts
import { normalizePopulate } from "@efesto-cloud/population";
import FooPopulator from "../populate/FooPopulator.js";

const normalized = normalizePopulate(spec, FooPopulator.SHAPE);
// normalized: NormalizedPopulate<FooShape>
```

- `spec` — any `Populate<FooShape>` value, or `undefined` (no
  population).
- `shape` — the static shape from the populator (`FooPopulator.SHAPE`,
  declared on the populator class).
- Returns a `NormalizedPopulate<FooShape>` with only valid keys and
  `undefined` stripped.

If `spec` is `undefined`, `normalized` is `undefined` too — the
populator builds no `include` and the repo skips eager-loading
entirely.

## Where shapes live

Two valid placements:

- **In `@*/core/src/repo/shape/`** — when the shape is reused across
  adapters (Prisma + stub) and the type is part of the public port
  surface. The repo interface imports the shape directly.
- **In `@*/prisma/src/repository/shape/`** — when the shape is
  primarily a Prisma concern and the stub adapter doesn't care
  about population.

In `task-planning` the `shape/` folder is currently empty (population
isn't in use). When it's added, putting shapes in core is the more
portable choice; the stub can ignore the `populate` option without
issue.

## Cross-layer interactions

- **Repo port (core)** exposes `populate?: Populate<FooShape>` in
  its `Options` namespace.
- **Use case (core)** decides whether to ask for population. Usually
  reads as `await this.fooRepo.findById(id, { populate: true })` or
  `{ populate: { bar: true } }`.
- **Populator (adapter)** subclasses `BasePrismaPopulator<FooShape>`
  (or `BasePopulator` for MongoDB), exposes the static `SHAPE`
  constant.
- **Mapper (adapter)** patches populated sub-entities into
  `entity.props` after building the base entity. See
  `references/prisma-population.md` for the patch pattern.
- **Entity (core)** declares the populated field as `Bar | null` or
  `Bar[]`, with a getter, and includes it in `toDTO()` as a `bar?:
  IBar | null` shape (optional in the DTO because it's not always
  loaded).

## "Seen in the wild"

In `task-planning` the population layer is reserved but unused —
`packages/core/src/shape/` exists but is empty. The patterns in this
file describe the design that's ready to be slotted in when an
aggregate first needs eager-loading.

For reference implementations, see the
`@efesto-cloud/prisma-population` package's source (it ships its own
test fixtures using `Foo` / `Bar` examples).
