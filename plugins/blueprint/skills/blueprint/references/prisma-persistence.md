# Prisma persistence

How to implement a repo port with Prisma. Lives in `@*/prisma/`. Assumes
the entity, DTO, and `IFooRepository` interface already exist
(see `references/entity.md`, `references/dto.md`,
`references/repository-port.md`).

The package owns three things: repo implementations
(`FooRepoImpl`), mappers (`FooMapper`), and the `install.ts`
installer that binds them to the symbols in `@*/core`.

## Files for a new entity

```
prisma/src/
├── mapper/
│   └── FooMapper.ts                 — IEntityMapper<Foo, FooRow>
├── repository/
│   └── FooRepoImpl.ts               — @injectable() implements IFooRepository
└── install.ts                       — edit to add the new binding
```

## Key concept: `IPrismaContext<TClient>`

The DB-context port lives in `@efesto-cloud/prisma-database-context`
and is bound by this package's `install.ts` to the Prisma client. It
exposes:

- **`this.db.client`** — either the root Prisma client or a transaction
  client. Inside a `runWithTransaction` callback, it's automatically
  the transaction client; outside, it's the root.
- **`this.db.runWithTransaction(async () => { ... })`** — wraps the
  callback in a Prisma `$transaction`. Multiple repo writes inside
  the callback share the same transaction.

```ts
@inject(InternalSymbols.DatabaseContext)
private readonly db: IPrismaContext<PrismaClient>,
```

No "session" parameter is needed in query calls — the context handles
it.

## No custom row type — use Prisma's payload type

Prisma generates row types for every model:

```ts
import type { Prisma } from "@task-management/prisma-client";

type FooRow = Prisma.FooGetPayload<object>;
```

With relations included:

```ts
type FooWithBars = Prisma.FooGetPayload<{ include: { bars: true } }>;
```

Don't define your own `FooDocument` / `FooRow` interface in the
adapter — that's Prisma's job, and decoupling from Prisma's generated
type would only let your hand-written one drift.

## The mapper

```ts
// prisma/src/mapper/FooMapper.ts
import type { IEntityMapper } from "@efesto-cloud/entity";
import { Foo, FooName, type TFooStatus } from "@task-management/core";
import type { Prisma } from "@task-management/prisma-client";
import { DateTime } from "luxon";

type FooRow = Prisma.FooGetPayload<object>;

const FooMapper: IEntityMapper<Foo, FooRow> = {
    from: (row: FooRow): Foo => {
        const name = FooName.create(row.name);
        if (name.isFailure()) {
            throw new Error(`Invalid name in database for Foo ${row.id}: ${row.name}`);
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

    to: (foo: Foo) => ({
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

### `from` rules

- **Reconstruct value objects** via their `create()` factory. If the
  VO's `create()` returns `isFailure`, the DB row is corrupt — throw
  with a message that identifies the row's `id`. Don't return
  `Result.err` from a mapper; the calling repo isn't equipped to
  handle a domain failure mid-row-mapping.
- **`DateTime.fromJSDate(row.x)`** for non-null dates. The Luxon zone
  defaults to the global `Europe/Rome` set in `core/src/server.ts`.
- **`DateTime.fromJSDate(row.x) as DateTime<true>`** when the field is
  typed as `DateTime<true> | null` (the deleted_at idiom). The cast
  is safe because Luxon's `fromJSDate` on a valid JS `Date` always
  produces a valid `DateTime`.
- **Cast enum-like strings** to the domain type:
  `row.status as TFooStatus`. Prisma stores the value as `string`;
  the cast asserts (without runtime check) that it's one of the
  union members. If you want a runtime check, add an enum-runtime
  check; usually the DB schema's column constraint is enough.
- **Pass `row.id` as the constructor's `id` argument** (the second
  positional parameter), not as a prop.

### `to` rules

- **`vo.toRaw()`** for value objects.
- **`dateTime.toJSDate()`** for non-null dates;
  `entity.deleted_at?.toJSDate() ?? null` for nullable.
- **Use entity getters** (`foo.name`, `foo.status`) rather than reaching
  into `foo.props`. The props are protected; only the entity should
  read them.
- **Never serialise populated relations.** They're loaded, not saved,
  through this path. See `references/prisma-population.md`.
- **`to` never fails.** The entity's invariants guarantee that every
  field can be serialised. If you find yourself wanting to throw
  inside `to`, the entity is missing an invariant.

## The repository

```ts
// prisma/src/repository/FooRepoImpl.ts
import type { IPrismaContext } from "@efesto-cloud/prisma-database-context";
import {
    type Foo,
    type IFooRepository,
    InternalSymbols,
    type TFooStatus,
} from "@task-management/core";
import type { PrismaClient } from "@task-management/prisma-client";
import { inject, injectable } from "inversify";
import FooMapper from "../mapper/FooMapper.js";

@injectable()
export default class FooRepoImpl implements IFooRepository {
    constructor(
        @inject(InternalSymbols.DatabaseContext)
        private readonly db: IPrismaContext<PrismaClient>,
    ) {}

    async findById(
        id: string,
        options?: { includeDeleted?: boolean },
    ): Promise<Foo | null> {
        const row = await this.db.client.foo.findFirst({
            where: options?.includeDeleted ? { id } : { id, deleted_at: null },
        });
        return row ? FooMapper.from(row) : null;
    }

    async list(filter: {
        status?: TFooStatus;
        q?: string;
        includeDeleted: boolean;
        limit: number;
        offset: number;
    }): Promise<{ items: Foo[]; total: number }> {
        const trimmedQ = filter.q?.trim();
        const where = {
            ...(filter.status ? { status: filter.status } : {}),
            ...(filter.includeDeleted ? {} : { deleted_at: null }),
            ...(trimmedQ
                ? { name: { contains: trimmedQ, mode: "insensitive" as const } }
                : {}),
        };
        const [rows, total] = await Promise.all([
            this.db.client.foo.findMany({
                where,
                orderBy: { created_at: "desc" },
                skip: filter.offset,
                take: filter.limit,
            }),
            this.db.client.foo.count({ where }),
        ]);
        return { items: rows.map(FooMapper.from), total };
    }

    async save(foo: Foo): Promise<void> {
        const data = FooMapper.to(foo);
        await this.db.client.foo.upsert({
            where: { id: data.id },
            create: data,
            update: data,
        });
    }
}
```

### Key patterns

- **`findFirst` vs `findUnique`** — `findFirst` allows the
  composite where clause `{ id, deleted_at: null }`. `findUnique`
  requires a unique-only key. Default to `findFirst` for soft-delete-
  aware lookups.
- **`findMany` + `count` in `Promise.all`** — the `{ items, total }`
  shape of `list()` requires both. Running them in parallel halves
  the round-trip cost.
- **`upsert` for `save()`** — handles both insert (new entity) and
  update (existing). The `create` and `update` payloads can be the
  same object because Prisma ignores extra fields appropriately.
- **`as const` on `mode: "insensitive"`** — Prisma's where types
  expect the literal, not the wider `string`. Without `as const`
  TypeScript widens and the type-check fails.

## Soft-delete filtering

Every read either filters `deleted_at: null` or opts in to seeing
deleted rows. The pattern:

```ts
where: options?.includeDeleted ? { id } : { id, deleted_at: null }
```

For `list`, the `includeDeleted` field is required (no default —
forces callers to be explicit). For `findById`, the `options` itself
is optional and the default behaviour excludes deleted rows.

Persisting a soft-delete is just a `save()`:

```ts
// in the use case
target.delete();
await this.fooRepo.save(target);
```

The mapper's `to()` writes `deleted_at: foo.deleted_at?.toJSDate() ?? null`
either way. No conditional path in `save()` is needed.

## Transactions

Use cases wrap multi-write operations in `this.db.runWithTransaction`.
The repo impl does nothing special — `this.db.client` automatically
points at the transaction client inside the callback:

```ts
// in a use case
async execute(input): Promise<Result<FooDto, DomainError>> {
    // ... validate ...

    const outcome = await this.db.runWithTransaction(async () => {
        await this.fooRepo.save(foo);
        await this.barRepo.saveMany(foo.bars);
        return foo;
    });

    return Result.ok(outcome.toDTO());
}
```

The repo impl itself never spells out `client.$transaction(...)` —
that's handled inside `IPrismaContext`. The repo only references
`this.db.client.foo.*`.

## Saving nested children

Two common shapes:

### Option A — Prisma's nested writes

When the children are wholly owned by the parent (e.g. `Foo` ⤳
`FooLineItem`s) and the schema declares the relation:

```ts
async save(foo: Foo): Promise<void> {
    const data = FooMapper.to(foo);
    await this.db.client.foo.upsert({
        where: { id: data.id },
        create: {
            ...data,
            items: { create: foo.items.map((item) => FooLineItemMapper.to(item)) },
        },
        update: {
            ...data,
            items: {
                upsert: foo.items.map((item) => ({
                    where: { id: item._id },
                    create: FooLineItemMapper.to(item),
                    update: FooLineItemMapper.to(item),
                })),
            },
        },
    });
}
```

The parent owns the lifecycle; the line items don't have their own
repo impl.

### Option B — Inject the child repo

When the child has independent lifecycle (e.g. `Pratica` ⤳ multiple
`TimesheetEntry`, but timesheet entries are also saved on their own):

```ts
constructor(
    @inject(InternalSymbols.DatabaseContext) private readonly db: IPrismaContext<PrismaClient>,
    @inject(InternalSymbols.Repo.TimesheetEntry) private readonly entryRepo: ITimesheetEntryRepository,
) {}

async save(pratica: Pratica): Promise<void> {
    const data = PraticaMapper.to(pratica);
    await this.db.client.pratica.upsert({ where: { id: data.id }, create: data, update: data });
    // Children save themselves through their own repo
    for (const entry of pratica.newEntries) {
        await this.entryRepo.save(entry);
    }
}
```

This pattern only makes sense inside a `runWithTransaction` callback
so the parent and children commit atomically.

## The installer

`prisma/src/install.ts` is the package's single public export. It
returns a `ContainerModule` that binds every symbol the adapter owns.

```ts
// prisma/src/install.ts
import PrismaContext, {
    type IPrismaContext,
} from "@efesto-cloud/prisma-database-context";
import { PrismaD1 } from "@prisma/adapter-d1";
import {
    type IFooRepository,
    type IMemberRepository,
    InternalSymbols,
} from "@task-management/core";
import { PrismaClient } from "@task-management/prisma-client";
import { ContainerModule } from "inversify";
import { PrismaClientSymbol } from "./PrismaSymbols.js";
import FooRepoImpl from "./repository/FooRepoImpl.js";
import MemberRepoImpl from "./repository/MemberRepoImpl.js";

export default function install(opts: {
    DB: ConstructorParameters<typeof PrismaD1>[0];
}) {
    return new ContainerModule((bind) => {
        // 1. Prisma client (singleton)
        bind<PrismaClient>(PrismaClientSymbol)
            .toDynamicValue(() => {
                const adapter = new PrismaD1(opts.DB);
                return new PrismaClient({ adapter });
            })
            .inSingletonScope();

        // 2. Database context (request-scoped, wraps the client)
        bind<IPrismaContext>(InternalSymbols.DatabaseContext)
            .toDynamicValue((ctx) =>
                new PrismaContext(ctx.container.get<PrismaClient>(PrismaClientSymbol)),
            )
            .inRequestScope();

        // 3. Repository implementations
        bind<IFooRepository>(InternalSymbols.Repo.Foo)
            .to(FooRepoImpl)
            .inRequestScope();
        bind<IMemberRepository>(InternalSymbols.Repo.Member)
            .to(MemberRepoImpl)
            .inRequestScope();
        // ... etc
    });
}
```

To add a new repo: add the import, add the binding. The installer is
the single coordination point for the package.

### `PrismaSymbols.ts`

```ts
// prisma/src/PrismaSymbols.ts
export const PrismaClientSymbol = Symbol.for("PrismaClient");
```

The Prisma client symbol is package-private (defined here, not in
`InternalSymbols`) because nothing outside the adapter needs it.

## Cross-layer summary

- **Port (`IFooRepository`)** lives in `@*/core/src/repo/`.
- **Mapper (`FooMapper`)** lives in `@*/prisma/src/mapper/`.
- **Implementation (`FooRepoImpl`)** lives in `@*/prisma/src/repository/`.
- **Binding** lives in `@*/prisma/src/install.ts`, using
  `InternalSymbols.Repo.Foo` imported from `@*/core`.
- The webapp's composition root calls `installPrisma({ DB })` (see
  `references/composition-root.md`).

## Checklist — new Prisma repo

- [ ] Entity, DTO, and `IFooRepository` interface exist.
- [ ] `prisma/src/mapper/FooMapper.ts` created with `from` + `to`.
- [ ] `FooMapper.from` reconstructs value objects; throws on corrupt
      data with a row-identifying message.
- [ ] `prisma/src/repository/FooRepoImpl.ts` created with
      `@injectable()` and `@inject(InternalSymbols.DatabaseContext)`.
- [ ] All read methods filter `deleted_at: null` by default.
- [ ] `list` returns `{ items, total }` via `Promise.all`.
- [ ] `save` uses `upsert`.
- [ ] Binding added to `prisma/src/install.ts`.
- [ ] If a stub adapter exists, mirror the binding with the
      in-memory impl.
- [ ] `pnpm -F @*/prisma typecheck` passes.

## "Seen in the wild"

- `packages/prisma/src/mapper/MemberMapper.ts` — value-object
  reconstruction with throw-on-corrupt.
- `packages/prisma/src/repository/MemberRepoImpl.ts` — full impl
  including `findByCode` (the non-filtered case), `list` with
  multi-column `q`, `countAdmins`.
- `packages/prisma/src/install.ts` — installer binding all four
  repos.
- `packages/prisma/src/PrismaSymbols.ts` — package-private symbol.
