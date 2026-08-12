# Persistence adapter

How a repository **port** declared in `@*/core` gets a concrete
implementation. The implementation never lives in core — it lives in a
**separate adapter package** keyed to the database the project chose
(Prisma, MongoDB, Drizzle, …). Core only knows the port.

This reference is **database-agnostic**: it describes the shape every
adapter shares. For the concrete code of a given database, use its
dedicated skill:

- **Prisma** → the `prisma-persistence` skill (repo impl with the Prisma
  client, generated payload row types, `@efesto-cloud/prisma-unit-of-work`).
- **MongoDB** → the `mongodb-persistence` skill (repo impl with a
  `Collection`, `Document` row types, `@efesto-cloud/mongodb-unit-of-work`).
- Any other store (Drizzle, raw SQL, an HTTP backend, …) follows the
  same shape; only the driver-specific calls differ.

Assumes the entity, DTO, and `IFooRepository` interface already exist
(see `references/entity.md`, `references/dto.md`,
`references/repository-port.md`).

## The split: port in core, everything else in the adapter

| Thing | Package | File |
| --- | --- | --- |
| Repository **port** (`IFooRepository`) | `@*/core` | `src/repo/IFooRepository.ts` |
| Repository **impl** (`FooRepoImpl`) | `@*/persistence-adapter` (e.g. `@*/prisma-adapter`, `@*/mongodb-adapter`) | `src/repository/FooRepoImpl.ts` |
| **Mapper** (`FooMapper`) — entity ⇄ stored record | `@*/persistence-adapter` | `src/mapper/FooMapper.ts` |
| **Installer** (`install()` → `ContainerModule`) | `@*/persistence-adapter` | `src/install.ts` |

The adapter package imports `@*/core` (for the port interfaces and DI
symbols) and `@efesto-cloud/*` (for `IEntityMapper`, the unit-of-work
port, etc.). Core never imports the adapter — the dependency arrow only
points downward (see `references/architecture.md`).

A project typically ships **one active adapter** plus a `@*/stub`
in-memory adapter for tests/mocks. Both expose the same `install()`
shape and bind the same `InternalSymbols.Repo.X` keys, so the use cases
above them are unaware of which one is loaded.

## The mapper — entity ⇄ stored record

The mapper is the only place that knows the database's record shape. It
implements `IEntityMapper<E, RAW>` from `@efesto-cloud/entity`, where
`RAW` is whatever the driver returns:

- Prisma → a generated payload type (`Prisma.FooGetPayload<…>`).
- MongoDB → a hand-written `FooDocument` type.
- Drizzle → the table's inferred `select` type.

```ts
// @*/persistence-adapter/src/mapper/FooMapper.ts
import type { IEntityMapper } from "@efesto-cloud/entity";
import { Foo, FooName, type TFooStatus } from "@my-app/core";
import { DateTime } from "luxon";

// RAW = the database's native record type for this entity.
type FooRow = { /* …driver-specific shape… */ };

const FooMapper: IEntityMapper<Foo, FooRow> = {
    from: (row: FooRow): Foo => {
        const name = FooName.create(row.name);
        if (name.isFailure()) {
            // Corrupt DB row: throw with a row-identifying message.
            throw new Error(`Invalid name for Foo ${row.id}: ${row.name}`);
        }
        return new Foo(
            {
                name: name.data,
                status: row.status as TFooStatus,
                created_at: DateTime.fromJSDate(row.created_at),
                updated_at: DateTime.fromJSDate(row.updated_at),
                deleted_at: row.deleted_at
                    ? (DateTime.fromJSDate(row.deleted_at) as DateTime<true>)
                    : null,
            },
            row.id,
        );
    },

    to: (foo: Foo): FooRow => ({
        id: foo._id,
        name: foo.name.toRaw(),
        status: foo.status,
        created_at: foo.created_at.toJSDate(),
        updated_at: foo.updated_at.toJSDate(),
        deleted_at: foo.deleted_at?.toJSDate() ?? null,
    }),
};

export default FooMapper;
```

### `from` rules (record → entity)

- **Reconstruct value objects** via their `create()` factory. If
  `create()` returns `isFailure`, the row is corrupt — **throw** with a
  message that identifies the row's `id`. Don't return `Result.err`
  from a mapper; the calling repo isn't equipped to handle a domain
  failure mid-row-mapping. (This is the one sanctioned place to throw —
  see `references/conventions.md`.)
- **Dates**: `DateTime.fromJSDate(row.x)` for non-null; add
  `as DateTime<true>` for the `deleted_at` idiom (the cast is safe — a
  valid JS `Date` always yields a valid `DateTime`).
- **Cast enum-like strings** to the domain type (`row.status as TFooStatus`).
  The store keeps them as `string`; rely on the schema constraint, or
  add a runtime check if you don't trust the data.
- **Pass the id positionally** as the entity constructor's `id`
  argument, not as a prop.

### `to` rules (entity → record)

- **`vo.toRaw()`** for value objects; **`dateTime.toJSDate()`** for
  dates (`?? null` for nullable).
- **Use entity getters** (`foo.name`), never `foo.props` (protected).
- **Never serialise eager-loaded relations** — they're loaded, not
  saved, through this path.
- **`to` never fails.** The entity's invariants guarantee every field
  serialises. Wanting to throw inside `to` means the entity is missing
  an invariant.

## The repository implementation

`@injectable()`, implements the core port, injects the unit-of-work
(transaction) port, and delegates row ↔ entity translation to the
mapper. Only the driver calls inside each method are database-specific.

```ts
// @*/persistence-adapter/src/repository/FooRepoImpl.ts
import { type Foo, type IFooRepository, InternalSymbols } from "@my-app/core";
import { inject, injectable } from "inversify";
import FooMapper from "../mapper/FooMapper.js";

@injectable()
export default class FooRepoImpl implements IFooRepository {
    constructor(
        // The transaction coordinator — see "Transactions" below.
        @inject(InternalSymbols.UnitOfWork)
        private readonly uow: /* IUnitOfWork-backed DB handle */,
    ) {}

    async findById(
        id: string,
        options?: { includeDeleted?: boolean },
    ): Promise<Foo | null> {
        // driver-specific read, filtering deleted_at unless opted in
        const row = await /* …query by id, deleted_at: null unless includeDeleted… */;
        return row ? FooMapper.from(row) : null;
    }

    async list(filter: {
        includeDeleted: boolean;
        limit: number;
        offset: number;
    }): Promise<{ items: Foo[]; total: number }> {
        // driver-specific read + count (run in parallel)
        const { rows, total } = await /* … */;
        return { items: rows.map(FooMapper.from), total };
    }

    async save(foo: Foo): Promise<void> {
        const data = FooMapper.to(foo);
        await /* driver-specific upsert by data.id */;
    }
}
```

### Cross-database invariants (true for every adapter)

- **Soft-delete is read-side filtering.** Every read filters
  `deleted_at IS NULL` by default; `{ includeDeleted: true }` opts in.
  There is no hard `delete` method — `save()` of a soft-deleted entity
  persists `deleted_at` (the mapper's `to` already writes it). See
  `references/conventions.md`.
- **`list` returns `{ items, total }`** — fetch page + count together
  (in parallel where the driver allows).
- **`save` is an upsert** — one method handles insert and update.

## Transactions — the unit-of-work port

Multi-write operations must be atomic without the use case knowing the
database. The generic contract is `IUnitOfWork` from
`@efesto-cloud/unit-of-work`:

```ts
interface IUnitOfWork {
    runWithTransaction<T>(fn: () => Promise<T>): Promise<T>;
}
```

- Core declares a DI token for it (commonly `InternalSymbols.UnitOfWork`
  or `…DatabaseContext`) typed as `IUnitOfWork`.
- The **adapter** binds that token to a database-specific implementation:
  `@efesto-cloud/prisma-unit-of-work` for Prisma, or
  `@efesto-cloud/mongodb-unit-of-work` for MongoDB. Each makes the
  ambient transaction handle available to the repo impls inside the
  callback, so repos don't take a `session`/`tx` parameter.

```ts
// in a use case — database-agnostic
const outcome = await this.uow.runWithTransaction(async () => {
    await this.fooRepo.save(foo);
    await this.barRepo.saveMany(foo.bars);
    return foo;
});
return Result.ok(outcome.toDTO());
```

## The installer

`@*/persistence-adapter/src/install.ts` is the package's single public export.
It returns a `ContainerModule` that binds the unit-of-work
implementation and every repo impl to the `InternalSymbols` keys
imported from `@*/core`.

```ts
// @*/persistence-adapter/src/install.ts
import { type IFooRepository, InternalSymbols } from "@my-app/core";
import { ContainerModule } from "inversify";
import FooRepoImpl from "./repository/FooRepoImpl.js";

export default function install(opts: { /* connection/config */ }) {
    return new ContainerModule((bind) => {
        // 1. The DB client/connection (singleton) — driver-specific.
        // 2. The unit-of-work / transaction handle bound to
        //    InternalSymbols.UnitOfWork (request-scoped).
        // 3. One binding per repo port:
        bind<IFooRepository>(InternalSymbols.Repo.Foo)
            .to(FooRepoImpl)
            .inRequestScope();
        // …one per entity…
    });
}
```

Any package-private symbols (e.g. the raw client token) live in the
adapter, **not** in `InternalSymbols` — nothing outside the adapter
needs them. To add a new repo: add the import, add the binding.

The composition root loads the chosen adapter's installer — generically
`installPersistence({…})`, concretely `installPrisma({…})` /
`installMongo({…})` / `installStub()` (see
`references/composition-root.md`).

## Eager-loading (population)

The generic `Expand<T>` / `Shape` type system (from `@efesto-cloud/expand`)
is database-agnostic and lives in `references/population.md`. The
concrete eager-loading implementation is adapter-specific
(`@efesto-cloud/prisma-expand`'s `BasePrismaExpander` + Prisma `include`,
`@efesto-cloud/mongodb-expand`'s `BaseExpander` + MongoDB `$lookup`, …)
and is covered by the database's dedicated population skill, not here.

## Cross-layer summary

- **Port** (`IFooRepository`) → `@*/core/src/repo/`.
- **Mapper** (`FooMapper`) → `@*/persistence-adapter/src/mapper/`.
- **Impl** (`FooRepoImpl`) → `@*/persistence-adapter/src/repository/`.
- **Binding** → `@*/persistence-adapter/src/install.ts`, using
  `InternalSymbols.Repo.Foo` imported from `@*/core`.
- Concrete driver code → the database's dedicated skill
  (`prisma-persistence`, `mongodb-persistence`, …).

## Checklist — new repo adapter

- [ ] Entity, DTO, and `IFooRepository` interface exist in `@*/core`.
- [ ] `@*/persistence-adapter/src/mapper/FooMapper.ts` implements
      `IEntityMapper<Foo, FooRow>` (`from` + `to`).
- [ ] `from` reconstructs value objects; throws on corrupt data with a
      row-identifying message. `to` never fails.
- [ ] `@*/persistence-adapter/src/repository/FooRepoImpl.ts` is `@injectable()`,
      injects the unit-of-work, delegates to the mapper.
- [ ] All reads filter `deleted_at` by default; `list` returns
      `{ items, total }`; `save` upserts.
- [ ] Binding added to `@*/persistence-adapter/src/install.ts`.
- [ ] If a `@*/stub` adapter exists, mirror the binding with the
      in-memory impl.
- [ ] For database-specific specifics, follow the matching skill
      (`prisma-persistence` / `mongodb-persistence`).
- [ ] `pnpm -F @*/persistence-adapter typecheck` passes.
