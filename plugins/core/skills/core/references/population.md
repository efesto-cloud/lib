# Population (generic)

Eager-loading of related entities. This file covers the DB-agnostic
type system from `@efesto-cloud/expand` —  the `Expand<T>` spec
format, `NormalizedExpand<SHAPE>`, and the **Shape** type. For the
concrete eager-loading implementation see the database's dedicated
population skill (`prisma-population` / `mongodb-population`).

Population is optional. Many repos don't need it. Add it when a use
case wants to load `Foo` plus its `bars` in one round-trip without
issuing separate queries.

## The Shape type

A Shape is a pure TypeScript type declaring which fields of an entity
**can** be populated. Lives at
`core/src/repo/shape/FooShape.ts` (or in the adapter, depending on
where the expander lives).

```ts
// core/src/repo/shape/FooShape.ts
import type { BazShape } from "./BazShape.js";  // only if Baz itself has an expander

export type FooShape = {
    bar: true;         // leaf: Bar has no further expansion, or we don't go deeper
    items: true;       // leaf: 1:many array, same rule
    baz: BazShape;     // nested: Baz itself is also expandable
};
```

Rules:

- **`true`** when the related entity has no expander of its own, or
  you intentionally don't allow callers to drill into its sub-
  relations.
- **`RelatedShape`** when the related entity has (or will have) its
  own expander and callers might want to populate its sub-fields.
- **Shape types have no runtime presence.** They're compile-time
  declarations consumed by `normalizeExpand()` and by the
  expander's `include` / `$lookup` logic.

A shape is the schema for what's loadable. The caller's spec
(`Expand<FooShape>`) is what they actually request.

## `Expand<T>` — the user-facing spec

`Expand<T>` is the flexible input format callers pass to repo
methods. It accepts many equivalent forms:

```ts
import type { Expand } from "@efesto-cloud/expand";
import type { FooShape } from "./shape/FooShape.js";

// All of these are valid Expand<FooShape>:

true                                    // populate everything (default depth)
"*"                                     // same as true
"bar"                                   // populate just bar
["bar", "items"]                        // populate bar and items
{ bar: true }                           // populate bar
{ bar: true, items: true }              // populate bar and items
{ baz: { nestedField: true } }          // nested: populate baz + its nested
["bar", { baz: { nestedField: true } }] // mixed array form
```

The exact definition of the type:

```ts
export type Expand<T> =
    | true                                              // populate all known fields
    | "*"                                               // same as true
    | keyof T                                           // single field
    | (keyof T)[]                                       // array of fields
    | { [K in keyof T]?: Expand<T[K]> }                 // object with nested specs
    | (keyof T | { [K in keyof T]?: Expand<T[K]> })[];  // mixed array
```

The repo interface exposes this:

```ts
import type { Expand } from "@efesto-cloud/expand";
import type { FooShape } from "./shape/FooShape.js";

interface IFooRepository {
    findById(id: string, options?: IFooRepository.Options): Promise<Foo | null>;
    list(filter, options?: IFooRepository.Options): Promise<{ items: Foo[]; total: number }>;
    save(foo: Foo): Promise<void>;
}

export namespace IFooRepository {
    export type Options = {
        expand?: Expand<FooShape>;
    };
}
```

The flexibility matters because callers have different needs:

- A simple route loader just wants `expand: true` to mean "give me
  everything reasonable".
- A targeted use case wants `expand: { baz: { nestedField: true } }`
  to fetch only one branch.

## `NormalizedExpand<SHAPE>` — the internal format

`normalizeExpand(spec, shape)` collapses every form above into a
single canonical shape:

```ts
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

You rarely work with `NormalizedExpand` directly — the expander's
base class consumes it.

## `normalizeExpand(spec, shape)` — the converter

```ts
import { normalizeExpand } from "@efesto-cloud/expand";
import FooExpander from "../expand/FooExpander.js";

const normalized = normalizeExpand(spec, FooExpander.SHAPE);
// normalized: NormalizedExpand<FooShape>
```

Signature:

```ts
function normalizeExpand<T extends Record<string, unknown>>(
    spec: Expand<T> | Expand<T>[] | undefined,
    shape: T,
): NormalizedExpand<T>;
```

- `spec` — any `Expand<FooShape>` value, an array of them, or
  `undefined` (no population).
- `shape` — the static shape from the expander (`FooExpander.SHAPE`,
  declared on the expander class).
- Returns a `NormalizedExpand<FooShape>` with only valid keys and
  `undefined` stripped.

If `spec` is `undefined`, `normalized` is `{}` (an empty object) —
the expander builds no `include` and the repo skips eager-loading
entirely.

## Where shapes live

Two valid placements:

- **In `@*/core/src/repo/shape/`** — when the shape is reused across
  adapters (the persistence adapter + stub) and the type is part of
  the public port surface. The repo interface imports the shape
  directly.
- **In `@*/persistence-adapter/src/repository/shape/`** — when the
  shape is primarily an adapter concern and the stub adapter doesn't
  care about population.

In `task-planning` the `shape/` folder is currently empty (population
isn't in use). When it's added, putting shapes in core is the more
portable choice; the stub can ignore the `expand` option without
issue.

## Cross-layer interactions

- **Repo port (core)** exposes `expand?: Expand<FooShape>` in
  its `Options` namespace.
- **Use case (core)** decides whether to ask for population. Usually
  reads as `await this.fooRepo.findById(id, { expand: true })` or
  `{ expand: { bar: true } }`.
- **Expander (adapter)** subclasses `BasePrismaExpander<FooShape>`
  (from `@efesto-cloud/prisma-expand`) or `BaseExpander` (from
  `@efesto-cloud/mongodb-expand`), and exposes the static `SHAPE`
  constant.
- **Mapper (adapter)** patches populated sub-entities into
  `entity.props` after building the base entity. See the database's
  dedicated population skill for the patch pattern.
- **Entity (core)** declares the populated field as `Bar | null` or
  `Bar[]`, with a getter, and includes it in `toDTO()` as a `bar?:
  IBar | null` shape (optional in the DTO because it's not always
  loaded).

## "Seen in the wild"

In `task-planning` the population layer is reserved but unused —
`packages/core/src/shape/` exists but is empty. The patterns in this
file describe the design that's ready to be slotted in when an
aggregate first needs eager-loading.

For concrete reference implementations — the `BasePrismaExpander` +
Prisma `include` path, or the `BaseExpander` + `QueryBuilder` +
MongoDB `$lookup` path — see the database's dedicated population
skill (`prisma-population` / `mongodb-population`). Those packages
(`@efesto-cloud/prisma-expand` / `@efesto-cloud/mongodb-expand`) ship
their own test fixtures using `Foo` / `Bar` examples.
