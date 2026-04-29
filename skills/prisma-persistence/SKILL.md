---
name: prisma-persistence
description: >
  Implement the Prisma persistence layer for a hexagonal architecture TypeScript project.
  Use this skill whenever the project uses Prisma and the user needs to create or modify
  a repository implementation, or wire up an entity's storage layer using the Prisma client.
  Trigger when the user says things like "create a Prisma repo for Foo",
  "add the Prisma persistence layer for X", "I need to persist Baz via Prisma",
  "create the Prisma repository and mapper", "wire up Foo to the Prisma client",
  or whenever the project uses Prisma and the storage layer for an entity is missing or incomplete.
  Also trigger when the user modifies an entity and the Prisma persistence files need to stay in sync.
  For the generic repository interface and mapper pattern (DB-agnostic), use the persistence skill first.
  For MongoDB use the mongodb-persistence skill instead.
---

# Prisma Persistence Skill

**Installation:** Add the required packages:
- `pnpm add @efesto-cloud/prisma-database-context` (for `IPrismaContext` and transaction support)
- `pnpm add @efesto-cloud/entity` (for `IEntityMapper` interface)
- `pnpm add @efesto-cloud/maybe` (for nullable results)

Helps you build the Prisma persistence layer — repository implementation and mapper — for a
hexagonal architecture TypeScript/Prisma project following the ports-and-adapters pattern.

**Assumes:** The entity class, DTO interface, and repository interface (`IFooRepo`) already exist.
The `persistence` skill covers the interface and mapper contract; this skill covers the Prisma
implementation.

**Does not cover:** Population (eager-loading of related entities). See the `prisma-population` skill.

---

## Before You Write Anything

1. **Read the entity and DTO** — understand which fields need type conversion (DateTime → Date/string, value objects → primitives, etc.).
2. **Read the repository interface** — match the exact method signatures and `Options` namespace.
3. **Check the Prisma schema** — identify the model name, field names, and relation fields.
4. **Scan existing Prisma repos in the project** — check `src/repo/impl/` for import style and patterns to match.

---

## Key Concept: `IPrismaContext<TClient>`

`IPrismaContext<TClient>` extends `IDatabaseContext` and provides `this.db.client`, which is
either the root Prisma client or a transaction-scoped client:

```typescript
import type { IPrismaContext } from "@efesto-cloud/prisma-database-context";
// this.db.client: TClient | PrismaTxOf<TClient>
```

**Transaction pattern:** call `this.db.runWithTransaction(async () => { ... })` from a use
case; inside the callback, `this.db.client` automatically switches to the transaction client.
No session params are needed in query calls — unlike MongoDB.

---

## No Document Type

Prisma generates its own model types. Do **not** create a custom `FooDocument.ts`.
Use Prisma's generated types directly:

```typescript
import type { Prisma } from "@prisma/client";

// For the mapper storage model type, use Prisma's payload type:
type FooRow = Prisma.FooGetPayload<object>;
// or with relations included:
type FooRow = Prisma.FooGetPayload<{ include: { bar: true } }>;
```

---

## Repository Implementation

```typescript
// src/repo/impl/FooRepoImpl.ts
import Maybe from "@efesto-cloud/maybe";
import type { IPrismaContext } from "@efesto-cloud/prisma-database-context";
import { inject, injectable } from "inversify";
import type { PrismaClient } from "@prisma/client";
import Symbols from "~/di/Symbols.js";
import Foo from "~/entity/Foo.js";
import FooMapper from "~/mapper/FooMapper.js";
import type IFooRepo from "../IFooRepo.js";
import type { SearchFoo } from "../IFooRepo.js";

@injectable()
export default class FooRepoImpl implements IFooRepo {
    constructor(
        @inject(Symbols.DatabaseContext)
        private readonly db: IPrismaContext<PrismaClient>,
    ) {}

    async search(query: SearchFoo): Promise<Foo[]> {
        const rows = await this.db.client.foo.findMany({
            where: {
                ...(query.name ? { name: { contains: query.name, mode: "insensitive" } } : {}),
                ...(query.include_deleted ? {} : { deleted_at: null }),
            },
            orderBy: { name: "asc" },
        });
        return rows.map(FooMapper.from);
    }

    async get(id: string): Promise<Maybe<Foo>> {
        const row = await this.db.client.foo.findUnique({ where: { id } });
        return Maybe.maybe(row).map(FooMapper.from);
    }

    async save(entity: Foo): Promise<void> {
        const data = FooMapper.to(entity);
        await this.db.client.foo.upsert({
            where: { id: data.id },
            create: data,
            update: data,
        });
    }
}
```

**`this.db.client`** — always reference this rather than a raw `PrismaClient` instance.
Inside a `runWithTransaction()` callback, `this.db.client` is automatically the transaction
client (`PrismaTxOf<PrismaClient>`), so writes are transactional with no extra work.

**Simple vs. population-aware reads:**
- Use `.findMany()`/`.findUnique()` for straightforward queries with no population.
- When the repo supports population, add the `include` option from a Prisma populator. See the `prisma-population` skill.

---

## Mapper

The mapper transforms between the domain entity and the Prisma model type. It is a plain
object implementing `IEntityMapper<Foo, FooRow>`:

```typescript
// src/mapper/FooMapper.ts
import type { IEntityMapper } from "@efesto-cloud/entity";
import { DateTime } from "luxon";
import type { Prisma } from "@prisma/client";
import Foo from "~/entity/Foo.js";

type FooRow = Prisma.FooGetPayload<object>;

const FooMapper: IEntityMapper<Foo, FooRow> = {
    from: (row: FooRow): Foo => {
        const entity = new Foo({
            name: row.name,
            deleted_at: row.deleted_at
                ? (DateTime.fromJSDate(row.deleted_at) as DateTime<true>)
                : null,
        }, row.id);

        // Patch in populated relations if they were joined:
        // if (row.bar) entity.props.bar = BarMapper.from(row.bar);

        return entity;
    },

    to: (domain: Foo) => ({
        id: domain._id,
        name: domain.props.name,
        deleted_at: domain.props.deleted_at?.toJSDate() ?? null,
    }),
};

export default FooMapper;
```

**`from` vs `to` asymmetry** — same rule as MongoDB: `from` may encounter joined relations
when population is used (check for presence and patch in); `to` only serializes own stored
fields, never populated relations.

**ID types** — Prisma IDs are typically `string` (cuid/uuid) or `number` (autoincrement),
not `ObjectId`. Match the Prisma schema's `@id` field type.

**DateTime** — `DateTime` in the entity/DTO becomes a JS `Date` in the Prisma row (Prisma
handles the conversion internally). Use `DateTime.fromJSDate()` in `from` and `.toJSDate()`
in `to`.

---

## DI Wiring

```typescript
// src/di/Symbols.ts — add in the Repo section:
Repo: {
    FooRepo: Symbol.for("FooRepo"),
}
```

```typescript
// src/di/container.ts
import FooRepoImpl from "~/repo/impl/FooRepoImpl.js";
import type IFooRepo from "~/repo/IFooRepo.js";

container.bind<IFooRepo>(Symbols.Repo.FooRepo).to(FooRepoImpl).inRequestScope();
```

The Prisma client itself is injected as `IPrismaContext<PrismaClient>` via
`Symbols.DatabaseContext`. Ensure `PrismaContext` is bound in the container:

```typescript
import PrismaContext from "@efesto-cloud/prisma-database-context";
// Typically done once at app bootstrap — check container.ts for existing binding.
container.bind(Symbols.DatabaseContext).to(PrismaContext).inSingletonScope();
```

---

## Special Cases

### Soft-delete

Entity has `deleted_at: DateTime<true> | null`. Records stay in the table; filtered by default:

```typescript
// In save():
if (entity.isDeleted()) {
    await this.db.client.foo.update({
        where: { id: entity._id },
        data: { deleted_at: entity.deleted_at!.toJSDate() },
    });
} else {
    const data = FooMapper.to(entity);
    await this.db.client.foo.upsert({ where: { id: data.id }, create: data, update: data });
}

// In search() where clause:
...(query.include_deleted ? {} : { deleted_at: null })
```

### Saving child entities from a parent repo

Inject and call child repos, or use Prisma's nested writes:

```typescript
// Option A — nested write (when child records are owned):
await this.db.client.foo.update({
    where: { id: entity._id },
    data: {
        bars: {
            upsert: entity.bars.map(bar => ({
                where: { id: bar._id },
                create: BarMapper.to(bar),
                update: BarMapper.to(bar),
            })),
        },
    },
});

// Option B — inject child repo (when Bar has its own independent lifecycle):
await this.barRepo.saveMany(entity.bars);
```

---

## Checklist — New Repository

- [ ] Read entity + DTO + repo interface + Prisma schema before writing anything
- [ ] `FooRepoImpl.ts` created — `@injectable()`, uses `this.db.client.*`
- [ ] `FooMapper.ts` created — `from()` handles optional populated relations; `to()` only own scalars
- [ ] `Symbols.Repo.FooRepo` added
- [ ] `container.bind(...).inRequestScope()` added
- [ ] Typecheck passes

## Checklist — Modifying Existing

- [ ] Read all files before changing anything
- [ ] New field → update mapper `from()` and `to()` + interface if signature changes
- [ ] Typecheck passes
