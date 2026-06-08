---
name: persistence
description: >
  Explain and scaffold the generic hexagonal-architecture persistence layer (repository port,
  mapper pattern, DI symbol structure) for a TypeScript project using @efesto-cloud/* libraries.
  Use this skill whenever the user needs to understand or create a repository interface,
  mapper contract, or DI symbol — independent of the underlying database.
  Trigger when the user says things like "create a repo interface for Foo",
  "what does the mapper look like", "I need to add persistence for X",
  "explain the repository pattern", "wire up Foo to the DI container",
  or whenever a domain entity exists and only the generic storage contract is needed.
  For the concrete MongoDB implementation (Document type, Collection, session) use the
  mongodb-persistence skill. For Prisma use the prisma-persistence skill.
---

# Persistence Skill

Helps you design the persistence layer port — repository interface, mapper contract, and DI
symbol registration — for a hexagonal architecture TypeScript project following the
ports-and-adapters pattern. This skill is DB-agnostic; it covers the shared concepts that
apply regardless of whether the backing store is MongoDB, Prisma, or anything else.

**Installation:** Add the core packages used by all persistence layers:
- `pnpm add @efesto-cloud/database-context` (for `IDatabaseContext` interface)
- `pnpm add @efesto-cloud/entity` (for `IEntityMapper` interface)
- `pnpm add @efesto-cloud/maybe` (for nullable results)

**Next step:** Once the interface and mapper shape are defined, install the DB-specific skill:
- MongoDB: `mongodb-persistence` skill
- Prisma: `prisma-persistence` skill

---

## Repository Interface (Port)

The repository interface is the hexagonal **port** — the boundary between your domain and
any storage implementation. It depends only on domain types; never on MongoDB, Prisma, or
any driver.

```typescript
// src/repo/IFooRepo.ts
import type IDatabaseContext from "@efesto-cloud/database-context";
import Maybe from "@efesto-cloud/maybe";
import Foo from "~/entity/Foo.js";

export type SearchFoo = {
    name?: string;
    include_deleted?: boolean;
};

interface IFooRepo {
    search(query: SearchFoo): Promise<Foo[]>;
    get(id: string): Promise<Maybe<Foo>>;
    save(entity: Foo): Promise<void>;
}

export default IFooRepo;
```

**Return type guide:**

| Scenario | Return type |
|---|---|
| Nullable single result | `Promise<Maybe<T>>` |
| Multiple results | `Promise<T[]>` — empty array, never Maybe |
| Write | `Promise<void>` |
| Count | `Promise<number>` |
| Large result set | `Readable` (stream) |

**When population will be added** — declare an `Options` namespace with a `populate` field.
The population skill handles everything else; the interface just exposes the hook:

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

---

## Mapper Pattern

The mapper transforms between the domain entity and the storage model. It is a plain object
(not a class) implementing `IEntityMapper<Entity, StorageModel>` from `@efesto-cloud/entity`.

```typescript
// src/mapper/FooMapper.ts
import type { IEntityMapper } from "@efesto-cloud/entity";
import type FooStorageModel from "...";  // DB-specific (FooDocument, Prisma model, etc.)
import Foo from "~/entity/Foo.js";

const FooMapper: IEntityMapper<Foo, FooStorageModel> = {
    /**
     * from: storage model → entity (read path)
     * Convert storage types to domain types. Patch in populated relations after construction.
     */
    from: (row: FooStorageModel): Foo => {
        const entity = new Foo({ name: row.name }, row.id);
        // If population is in use, patch in populated sub-entities here (check for presence):
        // if (row.bar) entity.props.bar = BarMapper.from(row.bar);
        return entity;
    },

    /**
     * to: entity → storage model (write path)
     * Only include fields the storage layer actually stores. Never include populated joins.
     */
    to: (domain: Foo): FooStorageModel => ({
        id: domain._id,
        name: domain.props.name,
    }),
};

export default FooMapper;
```

**`from` vs `to` asymmetry:**
- `from` is the read path — it may encounter populated sub-documents/relations from a join; construct the entity, then patch them in.
- `to` is the write path — serialize only own stored scalar fields and FKs. Never include populated joins.

**`new Foo()` vs `Foo.create()`** — in mappers, the direct constructor is appropriate because you have complete, already-validated stored state. Use `Foo.create()` in use cases where you're working with partial user input.

---

## DI Wiring

Add the repository symbol and binding to the DI container. The exact injection token and binding type vary by DB-specific skill, but the symbol structure is shared:

```typescript
// src/di/Symbols.ts — add in the Repo section:
Repo: {
    FooRepo: Symbol.for("FooRepo"),
    // ...
}
```

```typescript
// src/di/container.ts — bind the implementation:
container.bind<IFooRepo>(Symbols.Repo.FooRepo).to(FooRepoImpl).inRequestScope();
```

For the implementation class (`FooRepoImpl`) and any DB-specific constructor arguments (Collection, Prisma client, etc.), see the relevant DB-specific skill.

---

## Checklist — New Repository Interface

- [ ] Read the entity + DTO before writing anything
- [ ] `IFooRepo.ts` created with interface + exported search query type
- [ ] Return types follow the guide above (Maybe for single nullable, array for many)
- [ ] `Options` namespace added if population will be needed
- [ ] `Symbols.Repo.FooRepo` added
- [ ] Container binding added (implementation class comes from DB-specific skill)
- [ ] Typecheck passes
