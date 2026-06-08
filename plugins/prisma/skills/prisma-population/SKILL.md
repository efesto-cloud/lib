---
name: prisma-population
description: >
  Add Prisma population (eager-loading of related records via Prisma `include`) to an existing
  entity in a hexagonal architecture TypeScript project using @efesto-cloud/prisma-population.
  Use this skill whenever the project uses Prisma and the user says things like
  "populate Foo with its Bar", "add population support for FooEntity via Prisma",
  "I need to eager-load related entities in my Prisma repo",
  "add the populate option to FooRepo", "create the FooPopulator for Prisma",
  "Foo needs to include its related Bar when fetched",
  or whenever someone needs to add optional relational data loading to an existing Prisma repository.
  Trigger even if the user just says "add population" without specifying the entity — ask them.
  Do NOT trigger for creating entities, DTOs, or base repositories from scratch (those are handled
  by entity and prisma-persistence skills).
  For MongoDB-based projects use the mongodb-population skill instead.
  For the generic Shape type and Populate<T> concepts, see the population skill.
---

# Prisma Population Skill

**Installation:** If not already installed, add the required packages:
- `pnpm add @efesto-cloud/population` (for `Populate` type and `normalizePopulate` helper)
- `pnpm add @efesto-cloud/prisma-population` (for `BasePrismaPopulator` and `PrismaInclude`)

Adds Prisma population support — typed eager-loading of related records via Prisma `include` —
to an existing entity. The entity, its DTO, and repository are assumed to already exist.
This skill only patches them where needed and writes the population infrastructure.

**Scope:** Shape type, Populator, plus targeted patches to entity, DTO, mapper, and repository
interface/implementation.

**Does not:** create entities or repositories from scratch, write use cases, or manage DI
container wiring.

---

## Phase 0 — Clarify Intent

If the user has not specified which entity to populate and/or which fields should be populated,
use `AskUserQuestion` to ask:

1. Which entity needs population?
2. Which fields should be populatable, and for each:
   - What is the source table/model?
   - Is it a single value (1:1) or an array (1:many)?
   - Does the related entity itself have a populator already? (nested population)

Do not proceed until you have at least the entity name and one field to populate.

---

## Phase 1 — Discover the Project Structure

Before touching any file, orient yourself:

1. **Check the Prisma schema** — find the model definition for `Foo` and note all relation fields.
2. **Check for existing populators** — browse `src/repo/shape/`, `src/repo/populate/`. If any exist, read one to match the import style.
3. **Read the target entity** — `src/entity/FooEntity.ts`
4. **Read the target DTO** — `src/dto/IFoo.ts`
5. **Read the target mapper** — `src/mapper/FooMapper.ts`
6. **Read the repository interface** — `src/repo/IFooRepo.ts`
7. **Read the repository implementation** — `src/repo/impl/FooRepoImpl.ts`

If `src/repo/shape/` or `src/repo/populate/` directories do not yet exist, create them.

---

## Phase 2 — Patch Satellite Files

Patch each file only where something is actually missing. Do not rewrite files wholesale.

### 2a. Entity

For each populated field `bar` on entity `Foo`:

- **Props type** must include an optional field for the populated value:
  - 1:1 → `bar: Bar | null` (initialized to `null`)
  - 1:many → `bars: Bar[]` (initialized to `[]`)
- **`toDTO()`** — map the optional field: `bar: this.props.bar?.toDTO() ?? null`.
- **Getter** — add `get bar(): Bar | null` (or `Bar[]`) if missing.

### 2b. DTO

For each populated field `bar` on `IFoo`:
- Add `bar?: IBar | null` (optional — it may or may not be present depending on query).
- For 1:many: `bars?: IBar[]`.

### 2c. Mapper

For each populated field `bar`, update `FooMapper.from()`:

```typescript
// After building the base entity:
if (row.bar) {
    entity.props.bar = BarMapper.from(row.bar);
}
// or for arrays:
if (row.bars) {
    entity.props.bars = row.bars.map(BarMapper.from);
}
```

The `to()` direction (entity → storage) must **not** include populated relations — they are
loaded, not saved, through this path.

---

## Phase 3 — Write Population Core Files

Read the reference file before writing:
- `references/prisma-populator-example.ts` — complete Populator subclass examples

### 3a. Shape — `src/repo/shape/FooShape.ts`

```typescript
import type { BarShape } from "./BarShape.js"; // only if Bar also has a populator

export type FooShape = {
    bar: true;       // leaf: Bar has no further population, or we never go deeper
    items: true;     // leaf: 1:many, same rule
    baz: BazShape;   // nested: Baz has its own populator
};
```

For Shape type examples and rules, see the `population` skill's `references/shape-example.ts`.

### 3b. Populator — `src/repo/populate/FooPopulator.ts`

Subclass `BasePrismaPopulator<FooShape>`. Override `shape()` to return the static shape.
The base class uses `this.field()` internally; you do not need to call it manually — `build()`
iterates the normalized spec and calls `field()` for each requested key.

```typescript
import BasePrismaPopulator from "@efesto-cloud/prisma-population";
import type { FooShape } from "../shape/FooShape.js";

export default class FooPopulator extends BasePrismaPopulator<FooShape> {
    protected shape(): FooShape {
        return {
            bar: true,
            items: true,
        };
    }
}
```

**Nested population** — when a field references another Shape (e.g. `baz: BazShape`),
`toPrismaInclude` handles the nesting recursively. No extra code needed in the subclass;
just declare the correct Shape type.

See `references/prisma-populator-example.ts` for annotated examples including nested cases.

---

## Phase 4 — Patch the Repository

### 4a. Repository Interface — `src/repo/IFooRepo.ts`

Add the `Options` namespace with a `populate` field, and add `options?` to query methods:

```typescript
import type { Populate } from "@efesto-cloud/population";
import type { FooShape } from "./shape/FooShape.js";

interface IFooRepo {
    search(query: SearchFoo, options?: IFooRepo.Options): Promise<Foo[]>;
    get(id: string, options?: IFooRepo.Options): Promise<Maybe<Foo>>;
    save(entity: Foo): Promise<void>;
}

namespace IFooRepo {
    export type Options = {
        populate?: Populate<FooShape>;
    };
}
```

### 4b. Repository Implementation — `src/repo/impl/FooRepoImpl.ts`

Add import for `FooPopulator` and pass `include` to query calls:

```typescript
import FooPopulator from "../populate/FooPopulator.js";

async search(query: SearchFoo, options?: IFooRepo.Options): Promise<Foo[]> {
    const include = new FooPopulator().build(options?.populate);
    const rows = await this.db.client.foo.findMany({
        where: { ... },
        orderBy: { name: "asc" },
        ...(include ? { include } : {}),
    });
    return rows.map(FooMapper.from);
}

async get(id: string, options?: IFooRepo.Options): Promise<Maybe<Foo>> {
    const include = new FooPopulator().build(options?.populate);
    const row = await this.db.client.foo.findUnique({
        where: { id },
        ...(include ? { include } : {}),
    });
    return Maybe.maybe(row).map(FooMapper.from);
}
```

`build()` returns `undefined` when no population is requested, so the spread is safe.

---

## Phase 5 — Typecheck

Run the typecheck command for the core package then fix any errors before considering the
task done.

---

## Reference Files

- `references/prisma-populator-example.ts` — Annotated Populator examples (flat + nested)
- For Shape type examples: `population` skill's `references/shape-example.ts`
