---
name: mongodb-population
description: >
  Add MongoDB population (eager-loading of related documents via aggregation $lookup pipelines)
  to an existing entity in a hexagonal architecture TypeScript project using the @efesto-cloud/mongodb-expand
  package. Use this skill whenever the project uses MongoDB and the user says things like
  "populate Foo with its Bar", "add population support for FooEntity",
  "wire up the $lookup for Foo", "add the expand option to FooRepo",
  "create the QueryBuilder and Expander for Foo", "Foo needs to include its related Bar when fetched",
  or whenever someone needs to add optional relational data loading to an existing MongoDB repository.
  Trigger even if the user just says "add population" without specifying the entity — ask them.
  Do NOT trigger for creating entities, DTOs, or base repositories from scratch (those are handled
  by entity and mongodb-persistence skills).
  For Prisma-based projects use the prisma-population skill instead.
  For the generic Shape type and Expand<T> concepts, see the population skill.
---

# MongoDB Population Skill

**Installation:** If not already installed, add the required packages:
- `pnpm add @efesto-cloud/expand` (for `Expand` type and `normalizeExpand` helper)
- `pnpm add @efesto-cloud/mongodb-expand` (for `BaseExpander` and `QueryBuilder` classes)

Adds MongoDB population support — typed eager-loading of related documents via aggregation `$lookup` — to an existing entity. The entity, its DTO, document type, mapper, and repository are assumed to already exist. This skill only patches them where needed and writes the population infrastructure.

**Scope:** Shape type, QueryBuilder, Expander, plus targeted patches to entity, DTO, document, mapper, and repository interface/implementation.

**Does not:** create entities or repositories from scratch, write use cases, or manage DI container wiring.

---

## Phase 0 — Clarify Intent

If the user has not specified which entity to populate and/or which fields should be populated, use `AskUserQuestion` to ask:

1. Which entity needs population?
2. Which fields should be populatable, and for each:
   - What is the source collection/entity?
   - Is it a single value (1:1) or an array (1:many)?
   - Does the related entity itself have an expander already? (nested population)

Do not proceed until you have at least the entity name and one field to populate.

---

## Phase 1 — Discover the Project Structure

Before touching any file, orient yourself:

1. **Find the collection enum** — typically `src/db/CollectionNameEnum.ts` or similar. You'll need the collection name constant for `$lookup`.
2. **Check for existing expanders** — browse `src/repo/shape/`, `src/repo/expand/`, `src/repo/query/`. If any exist, read one to match the exact import style.
3. **Read the target entity** — `src/entity/FooEntity.ts`
4. **Read the target DTO** — `src/dto/IFoo.ts`
5. **Read the target document** — `src/db/Documents/FooDocument.ts`
6. **Read the target mapper** — `src/mapper/FooMapper.ts`
7. **Read the repository interface** — `src/repo/IFooRepo.ts`
8. **Read the repository implementation** — `src/repo/impl/FooRepoImpl.ts`

If `src/repo/shape/` or `src/repo/expand/` directories do not yet exist, create them.

---

## Phase 2 — Patch Satellite Files

Patch each file only where something is actually missing. Do not rewrite files wholesale.

### 2a. Entity

For each populated field `bar` on entity `Foo`:

- **Props type** must include an optional field for the populated value:
  - 1:1 → `bar: Bar | null` (initialized to `null` in `create()`)
  - 1:many via foreign key on Bar → `bars: Bar[]` (initialized to `[]` in `create()`)
- **`create()` static method** — if the populated field has a meaningful default, accept it as an optional param. Typically `bar` is not passed to `create()` (it starts null/empty and is filled by the mapper after aggregation).
- **`toDTO()`** — if the DTO has an optional `bar?` field, map it: `bar: this.props.bar?.toDTO() ?? null`.
- **Getter** — add `get bar(): Bar | null` (or `Bar[]`) if missing.
- **No `expandBar()` mutation method needed** — the mapper sets the field directly after aggregation.

### 2b. DTO

For each populated field `bar` on `IFoo`:

- Add `bar?: IBar | null` (optional — it may or may not be present depending on query).
- For 1:many: `bars?: IBar[]`.
- If the DTO lives inside a namespace, add the field to the correct variant.
- If a separate `index.ts` re-exports the DTO, no change needed there unless you added a new sub-type.

### 2c. Document

For each populated field `bar` on `FooDocument`:

- Add `bar?: BarDocument | null` (always optional — absent on raw stored documents, present only after `$lookup`).
- For 1:many: `bars?: BarDocument[]`.
- The FK reference field (`bar_id: ObjectId | null`) should already be present; do not add a second FK.

### 2d. Mapper

For each populated field `bar`, update `FooMapper.from()`:

```typescript
// After building the base entity:
if (doc.bar) {
    entity.props.bar = BarMapper.from(doc.bar);
}
// or for arrays:
if (doc.bars) {
    entity.props.bars = doc.bars.map(BarMapper.from);
}
```

The `to()` direction (entity → document) should **not** include populated fields — they are loaded, not saved, through this path.

---

## Phase 3 — Write Population Core Files

Read the reference files before writing:
- `references/query-builder-example.ts` — QueryBuilder with `expandWith()`
- `references/populator-example.ts` — flat Expander (no nesting)
- `references/populator-nested-example.ts` — nested Expander delegating to sub-expander
- For Shape type examples, see the `population` skill's `references/shape-example.ts`

### 3a. Shape — `src/repo/shape/FooShape.ts`

```typescript
// Leaf fields use `true`; fields whose related entity is also populatable use that entity's Shape type.
import type { BarShape } from './BarShape.js'; // only if Bar also has an expander

export type FooShape = {
    bar: true;           // 1:1, leaf — Bar has no further population
    items: true;         // 1:many, leaf
    baz: BazShape;       // 1:1, nested — Baz itself has populatable fields
};
```

### 3b. QueryBuilder — `src/repo/query/FooQueryBuilder.ts`

```typescript
import { normalizeExpand, type Expand } from '@efesto-cloud/expand';
import { QueryBuilder } from '@efesto-cloud/mongodb-expand';
import FooDocument from '~/db/Documents/FooDocument.js';
import FooExpander from '../expand/FooExpander.js';
import type { FooShape } from '../shape/FooShape.js';

export default class FooQueryBuilder extends QueryBuilder<FooDocument> {
    expandWith(fields: Expand<FooShape> = {}): this {
        const normalized = normalizeExpand(fields, FooExpander.SHAPE);
        const pipeline = FooExpander.buildPipeline(normalized);
        this.push_expand_pipeline(pipeline);
        return this;
    }
}
```

### 3c. Expander — `src/repo/expand/FooExpander.ts`

For each field:
- **1:1 relationship** (Bar lives in its own collection, Foo stores `bar_id`): use `lookup` + `unwind`.
- **1:many relationship** (Bar stores `foo_id` as FK, or Foo stores an array of IDs): use `lookup` only, no `unwind`.
- **Nested population** (Bar itself has an expander): pass a sub-pipeline to the `lookup`. See `references/populator-nested-example.ts`.

```typescript
import { BaseExpander } from '@efesto-cloud/mongodb-expand';
import type { NormalizedExpand } from '@efesto-cloud/expand';
import CollectionNameEnum from '~/db/CollectionNameEnum.js';
import type TCollectionName from '~/db/TCollectionName.js';
import type { FooShape } from '../shape/FooShape.js';

export default class FooExpander extends BaseExpander<FooShape, TCollectionName> {
    static readonly SHAPE: FooShape = {
        bar: true,
        items: true,
    };

    private bar(): void {
        if (!this.markExpanded('bar')) return;
        this.addStages(
            this.lookup({
                from: CollectionNameEnum.bar,   // collection name constant
                localField: 'bar_id',           // FK on Foo document
                foreignField: '_id',
                as: 'bar',
            }),
            this.unwind('bar'),                 // 1:1 — flatten array to single object
        );
    }

    private items(): void {
        if (!this.markExpanded('items')) return;
        this.addStages(
            this.lookup({
                from: CollectionNameEnum.item,
                localField: '_id',              // Foo's own _id
                foreignField: 'foo_id',         // FK on Item documents
                as: 'items',
            }),
            // No unwind — keeps the array
        );
    }

    expand(spec: NormalizedExpand<FooShape>): this {
        if (spec.bar) this.bar();
        if (spec.items) this.items();
        return this;
    }

    static buildPipeline(spec: NormalizedExpand<FooShape>): import('mongodb').Document[] {
        return new FooExpander().expand(spec).build();
    }
}
```

---

## Phase 4 — Patch the Repository

### 4a. Repository Interface — `src/repo/IFooRepo.ts`

Add the `Options` namespace with an `expand` field, and add `options?` param to every query method (save/saveMany/delete do not need it):

```typescript
import type { Expand } from '@efesto-cloud/expand';
import type { FooShape } from './shape/FooShape.js';

interface IFooRepo {
    search(query: IFooRepo.Search, options?: IFooRepo.Options): Promise<Foo[]>;
    get(id: ObjectId, options?: IFooRepo.Options): Promise<Maybe<Foo>>;
    findByIds(ids: ObjectId[], options?: IFooRepo.Options): Promise<Foo[]>;
    // ... other query methods
    save(entity: Foo): Promise<void>;
}

namespace IFooRepo {
    export type Options = {
        expand?: Expand<FooShape>;
    };
}

export default IFooRepo;
```

### 4b. Repository Implementation — `src/repo/impl/FooRepoImpl.ts`

Switch each query method to use `FooQueryBuilder` with `.expandWith(options?.expand)`:

```typescript
async get(id: ObjectId, options?: IFooRepo.Options): Promise<Maybe<Foo>> {
    const pipeline = new FooQueryBuilder()
        .match({ _id: id } as Filter<FooDocument>)
        .expandWith(options?.expand)
        .limit(1)
        .build();

    const results = await this.coll.aggregate<FooDocument>(
        pipeline, { session: this.db.session }
    ).toArray();

    if (results.length === 0) return Maybe.none();
    return Maybe.maybe(FooMapper.from(results[0]!));
}
```

Methods that already use `aggregate()` just need `.expandWith(options?.expand)` inserted into the builder chain. Methods that use `findOne()` or `find()` should be converted to `aggregate()` with the QueryBuilder.

---

## Special Cases

### Polymorphic entity (discriminated union)
If `Foo` has a `type` discriminator and different variants have different populatable fields:
- The Shape can include all fields across variants: `{ fontFile: true; rasterFile: true; vectorFile: true; }`.
- In the expander, each private method expands only the relevant field — because `$lookup` on a non-existent FK just returns an empty array, which is then dropped by `unwind` or ignored.
- Alternatively, if the variant shapes are completely disjoint, create separate Shape types with a union.

### Nested population (the related entity also has an expander)
When `Bar` itself has a `BarExpander`, you can pass a sub-pipeline into the `$lookup`:
```typescript
private bar(nestedSpec: NormalizedExpand<BarShape>): void {
    if (!this.markExpanded('bar')) return;
    const nestedPipeline = BarExpander.buildPipeline(nestedSpec);
    this.addStages(
        this.lookup({
            from: CollectionNameEnum.bar,
            localField: 'bar_id',
            foreignField: '_id',
            as: 'bar',
            pipeline: nestedPipeline,    // <-- sub-population
        }),
        this.unwind('bar'),
    );
}
```
The Shape field must then be typed as `BarShape` (not `true`), and the `expand()` method receives `spec.bar` as a `NormalizedExpand<BarShape>`.

### `$lookup` with `$in` (Foo stores an array of IDs)
When `Foo.bar_ids` is an array of ObjectIds pointing to Bar documents:
```typescript
this.lookup({
    from: CollectionNameEnum.bar,
    localField: 'bar_ids',   // array field on Foo
    foreignField: '_id',
    as: 'bars',
})
// No unwind — result is an array matching the IDs
```

### Optional relationship (FK can be null)
For `bar_id: ObjectId | null`, the `$lookup` returns an empty array when FK is null. `unwind()` always uses `preserveNullAndEmptyArrays: true`, so nullable FKs are handled safely with the standard call:
```typescript
this.addStages(
    this.lookup({ from: CollectionNameEnum.bar, localField: 'bar_id', foreignField: '_id', as: 'bar' }),
    this.unwind('bar'),
);
```
Then in the mapper: `entity.props.bar = doc.bar ? BarMapper.from(doc.bar) : null`.

---

## Phase 5 — Typecheck

Run the typecheck command for the core package then fix any errors before considering the task done.

---

## Reference Files

- `references/query-builder-example.ts` — Full QueryBuilder
- `references/populator-example.ts` — Flat expander (leaf fields only)
- `references/populator-nested-example.ts` — Expander with nested sub-population
- Shape type examples: see `population` skill's `references/shape-example.ts`
