# Prisma population

Add Prisma `include`-based eager loading to an existing repo.
Implementation half of population; the generic types are in
`references/population.md`.

Lives in `@*/prisma/src/repository/`. Touches the entity, DTO, mapper,
repo interface, and repo implementation.

## Prerequisite

The aggregate already has: entity, DTO, repo port interface, repo
impl, mapper. Population only adds eager loading; it doesn't bootstrap
the basic CRUD scaffolding.

## Step 1 — Decide what to populate

A `Foo` has:

- A 1:1 relation `bar: Bar` (each Foo has at most one Bar).
- A 1:many relation `items: FooItem[]`.
- A 1:1 relation `baz: Baz` where `Baz` is itself populatable (i.e.
  already has its own populator).

The decision: which of these does the use case need to eager-load?
Each is opt-in via `Populate<FooShape>`.

## Step 2 — Shape

```ts
// core/src/repo/shape/FooShape.ts
import type { BazShape } from "./BazShape.js";

export type FooShape = {
    bar: true;
    items: true;
    baz: BazShape;
};
```

See `references/population.md` for the type rules.

## Step 3 — Populator

```ts
// prisma/src/repository/populate/FooPopulator.ts
import BasePrismaPopulator from "@efesto-cloud/prisma-population";
import type { FooShape } from "@task-management/core/repo/shape/FooShape.js";

export default class FooPopulator extends BasePrismaPopulator<FooShape> {
    protected shape(): FooShape {
        return {
            bar: true,
            items: true,
            baz: BazPopulator.SHAPE,
        };
    }
}
```

What `BasePrismaPopulator` does:

- Provides the static `SHAPE` constant (computed from `shape()`).
- Provides `build(spec?): Prisma.FooInclude | undefined` — takes a
  `Populate<FooShape>` and returns a Prisma `include` object (or
  `undefined` when no population is requested).
- Handles nested population recursively through `toPrismaInclude`.

You only override `shape()`. The runtime details are in the base
class.

## Step 4 — Patch the entity

Add the populated fields to `FooProps`:

```ts
type FooProps = {
    name: FooName;
    bar_id: string | null;        // FK stays
    bar: Bar | null;              // populated value (null when not loaded
                                  // or when there is no Bar)
    items: FooItem[];             // populated value ([] when not loaded
                                  // or when there are no items)
    // ...
};
```

Add a getter for each:

```ts
get bar(): Bar | null { return this.props.bar; }
get items(): FooItem[] { return this.props.items; }
```

In `Foo.create(...)`, initialise to `null` / `[]` because population
hasn't happened yet:

```ts
return Result.ok(new Foo({
    name: name.data,
    bar_id: props.bar_id ?? null,
    bar: null,
    items: [],
    // ...
}, id));
```

Update `toDTO()` to expose them (optional fields):

```ts
toDTO(): FooDto {
    return {
        // ...
        bar_id: this.props.bar_id,
        bar: this.props.bar?.toDTO() ?? null,
        items: this.props.items.map((i) => i.toDTO()),
    };
}
```

## Step 5 — Patch the DTO

```ts
interface FooDto {
    // ...
    bar_id: string | null;
    bar?: BarDto | null;       // optional — may not be present
    items?: FooItemDto[];      // optional — may not be present
}
```

The populated DTO fields are **optional** because they're loaded only
when the caller asked for them. The route/loader / client code checks
for presence before rendering.

## Step 6 — Patch the mapper

The mapper now also reconstructs populated relations from the row's
included sub-rows:

```ts
type FooRow = Prisma.FooGetPayload<{ include: { bar: true; items: true; baz: true } }>;

const FooMapper: IEntityMapper<Foo, FooRow> = {
    from: (row): Foo => {
        // ... build the base entity ...
        const foo = new Foo({
            name: name.data,
            bar_id: row.bar_id,
            bar: null,             // start null
            items: [],             // start empty
            // ...
        }, row.id);

        // patch populated sub-entities only if Prisma actually loaded them
        if (row.bar) {
            foo.props.bar = BarMapper.from(row.bar);
        }
        if (row.items) {
            foo.props.items = row.items.map(FooItemMapper.from);
        }
        if (row.baz) {
            foo.props.baz = BazMapper.from(row.baz);
        }

        return foo;
    },

    to: (foo) => ({
        id: foo._id,
        name: foo.name.toRaw(),
        bar_id: foo.props.bar_id,
        // NEVER include populated relations in `to()` — they're
        // loaded, not stored. The DB row's `bar` / `items` are
        // populated only on read, never written.
    }),
};
```

Key rules:

- `from()` checks `if (row.bar)` because Prisma omits the field
  entirely when `include` didn't request it. The check is "did we
  load this relation?", not "does it exist?".
- `from()` writes into `foo.props.<x>` directly — yes, that touches
  protected state, but the mapper is the canonical mechanism for
  hydrating an entity and the protection isn't meant to keep the
  mapper out. Some codebases add an entity-level `markPopulated()`
  method for this; in `task-planning` the props write is direct.
- `to()` **never** includes populated relations. They're not part of
  the storage path.

`Prisma.FooGetPayload<{ include: { ... } }>` is wider than the row
without includes; declare the include shape statically so TypeScript
catches mistakes.

## Step 7 — Patch the repo interface

```ts
// core/src/repo/IFooRepository.ts
import type { Populate } from "@efesto-cloud/population";
import type { FooShape } from "./shape/FooShape.js";

interface IFooRepository {
    findById(id: string, options?: IFooRepository.Options): Promise<Foo | null>;
    list(filter, options?: IFooRepository.Options): Promise<{ items: Foo[]; total: number }>;
    save(foo: Foo): Promise<void>;
}

export namespace IFooRepository {
    export type Options = {
        includeDeleted?: boolean;
        populate?: Populate<FooShape>;
    };
}
```

The `Options` namespace is the canonical place to grow optional flags
that touch reads. Soft-delete and population both live there.

## Step 8 — Patch the repo impl

```ts
// prisma/src/repository/FooRepoImpl.ts
import FooPopulator from "./populate/FooPopulator.js";

@injectable()
export default class FooRepoImpl implements IFooRepository {
    constructor(
        @inject(InternalSymbols.DatabaseContext)
        private readonly db: IPrismaContext<PrismaClient>,
    ) {}

    async findById(
        id: string,
        options?: IFooRepository.Options,
    ): Promise<Foo | null> {
        const include = new FooPopulator().build(options?.populate);
        const row = await this.db.client.foo.findFirst({
            where: options?.includeDeleted ? { id } : { id, deleted_at: null },
            ...(include ? { include } : {}),
        });
        return row ? FooMapper.from(row) : null;
    }

    async list(filter, options?: IFooRepository.Options) {
        const include = new FooPopulator().build(options?.populate);
        const where = { /* ... */ };
        const [rows, total] = await Promise.all([
            this.db.client.foo.findMany({
                where,
                orderBy: { created_at: "desc" },
                skip: filter.offset,
                take: filter.limit,
                ...(include ? { include } : {}),
            }),
            this.db.client.foo.count({ where }),
        ]);
        return { items: rows.map(FooMapper.from), total };
    }
    // save() unchanged.
}
```

- `new FooPopulator().build(options?.populate)` returns either a
  `Prisma.FooInclude` or `undefined`.
- The conditional spread `...(include ? { include } : {})` keeps
  Prisma's query options clean when no population is requested.

## Use-case side

```ts
async execute(input): Promise<Result<FooDto, DomainError>> {
    const target = await this.fooRepo.findById(input.foo_id, {
        populate: { bar: true, items: true },
    });
    if (!target) return Result.err(new FooNotFoundError());

    return Result.ok(target.toDTO());
    // The returned DTO has `bar` and `items` populated; clients see them.
}
```

Use cases that don't need population call `findById(id)` without the
option and get back a `Foo` with `bar: null`, `items: []`. The DTO
omits the populated fields (or returns them as `null` / `[]`).

## Common populator subclasses

| Aggregate | Pattern |
|-----------|---------|
| Linear (`Foo` → `Bar`, `Bar` → `Baz`) | Each layer has its own populator; nest via `BazPopulator.SHAPE`. |
| 1:many flat (`Foo` ⤳ `FooItem[]`) | Shape says `items: true`; mapper maps the array. |
| Polymorphic (`Pratica` is `Prospect | Commessa`) | Single populator per variant or one populator that picks based on discriminant. |
| Recursive (`Category` → `Category[]` children) | Bounded depth — shape declares the recursion explicitly. Be careful with infinite trees. |

## Cross-layer summary

- **Shape** (core or adapter) — what's loadable, in the type system.
- **Populator** (adapter) — turns a `Populate<Shape>` into a Prisma
  `include`.
- **Repo port** (core) — exposes `populate?: Populate<Shape>` in its
  `Options`.
- **Repo impl** (adapter) — builds the `include` and passes it to
  Prisma.
- **Mapper** (adapter) — patches populated relations into the entity
  conditionally.
- **Entity / DTO** (core) — expose populated fields as optional.
- **Use case** (core) — decides whether to populate and what to
  populate.

## Checklist — adding population to an aggregate

- [ ] `core/src/repo/shape/FooShape.ts` created (or in the adapter).
- [ ] `prisma/src/repository/populate/FooPopulator.ts` created,
      extends `BasePrismaPopulator<FooShape>`.
- [ ] Entity props add the populated fields (`bar: Bar | null`,
      `items: Bar[]`).
- [ ] Entity getters added; `toDTO()` includes the populated fields.
- [ ] DTO interface adds the populated fields as optional.
- [ ] Mapper's `from()` patches in populated relations
      conditionally (`if (row.bar) ...`).
- [ ] Mapper's `to()` does NOT include populated relations.
- [ ] Repo interface's `Options` namespace gains `populate?:
      Populate<FooShape>`.
- [ ] Repo impl spreads `include` into Prisma queries.
- [ ] `pnpm -F @*/core typecheck && pnpm -F @*/prisma typecheck`
      passes.

## "Seen in the wild"

Population is currently unused in `task-planning` (the `shape/`
folder exists but is empty). When the first use case needs it, the
file paths above describe where things will go.
