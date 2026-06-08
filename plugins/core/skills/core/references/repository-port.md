# Repository port

The interface use cases use to persist and look up entities. Lives in
`core/src/repo/`. Implementations live in adapter packages — the
chosen-DB adapter (`@*/persistence-adapter`, concretely
`@*/prisma-adapter` / `@*/mongodb-adapter` / `@*/drizzle-adapter`, …)
and the in-memory `@*/stub`.

## What a repo port is

A repo port is a TypeScript interface that exposes the **domain-
shaped** persistence operations for one aggregate. Aggregate = the
entity that owns its boundary (`Member`, `Pratica`, `TimesheetEntry`).
Each aggregate has exactly one repo port.

The port:

- Speaks in **domain types**: returns `Foo`, accepts `Foo`, uses
  domain enums and value-object factories.
- **Never** mentions Prisma, MongoDB, SQL, or any storage tech — those
  are just the databases an adapter might target; the port is blind to
  the choice.
- **Never** has a `delete(id)` method — soft-delete only.
- Returns `null` for missing single lookups; returns `[]` for empty
  result lists.

## The minimum shape

```ts
// core/src/repo/IFooRepository.ts
import type Foo from "~/entity/Foo.js";
import type TFooStatus from "~/type/TFooStatus.js";

interface IFooRepository {
    findById(
        id: string,
        options?: { includeDeleted?: boolean },
    ): Promise<Foo | null>;

    list(filter: {
        status?: TFooStatus;
        q?: string;
        includeDeleted: boolean;
        limit: number;
        offset: number;
    }): Promise<{ items: Foo[]; total: number }>;

    save(foo: Foo): Promise<void>;
}

export default IFooRepository;
```

Conventions:

- **`findById(id, options?)`** — the canonical lookup. Returns
  `Foo | null`. The `options.includeDeleted` flag is the only way to
  see soft-deleted rows; default is "exclude". Used by restore use
  cases.
- **`findByX(value)`** — additional lookups by other unique keys
  (`findByEmail`, `findByCode`, `findByCalendarFeedToken`). Each
  returns `Foo | null`. Most filter `deleted_at` by default; document
  exceptions inline (see `findByCode` in `IMemberRepository.ts` for an
  example — it deliberately does not filter, because the DB uniqueness
  index spans deleted rows).
- **`list(filter)`** — paged read. The filter object includes
  pagination (`limit`, `offset`), an explicit `includeDeleted: boolean`
  (no default; force callers to think), and any domain filters.
  Returns `{ items, total }` so the caller has both the page and the
  full count for "showing 21–40 of 137".
- **`save(entity)`** — upsert. The repo decides whether to insert or
  update based on `entity.isNew()`. Soft-delete is just a `save()` of
  an entity whose `deleted_at` is set.
- **`count<X>()`** — when a single integer is needed (e.g.
  `countAdmins()` for "don't let the last admin be removed").

## Type-only re-export

```ts
// core/src/repo/index.ts
export type { default as IFooRepository } from "./IFooRepository.js";
```

Adapter packages import the interface as a type only. The runtime
binding side imports `InternalSymbols.Repo.Foo` separately.

## Why no `delete(id)` method

Two reasons:

1. **Soft-delete is a domain operation.** It needs the entity to be
   loaded so audit fields can be populated, last-admin guards can run,
   etc. Skipping the load would also skip those rules.
2. **The repo's contract stays small.** Three methods (`findById`,
   `list`, `save`) cover the bulk of every aggregate. Adding
   `delete(id)` would invite further "convenience" methods that
   bypass the domain.

If you genuinely need to remove rows (expired sessions, GC'd
notifications), name the method after the operation:

```ts
purgeExpiredSessions(): Promise<number>;
```

Specific, narrow, infrequent.

## Why `null` and not `Maybe<Foo>`

Repo single-lookups returning `null` are an idiom — TypeScript's `T |
null` is unambiguous and the call sites are simple:

```ts
const target = await this.fooRepo.findById(input.foo_id);
if (!target) return Result.err(new FooNotFoundError());
```

`Maybe<Foo>` adds a `.isSome()` / `.isNone()` ceremony for no
expressive gain at this boundary. Reserve `Maybe<T>` for service-port
methods where the absence carries domain meaning (see
`monad-maybe.md`).

## Why `{ items, total }` for paged reads

Two reasons:

1. Pagination UI needs both the page (`items`) and the total
   (`total`) — "21–40 of 137". Returning `Foo[]` plus a separate
   `count()` call is two queries; bundling them is one round-trip
   (the impl uses `Promise.all([findMany, count])`).
2. The return type is self-describing. `Foo[]` could be "all" or "a
   page" depending on context; `{ items, total }` is unambiguous.

For unbounded reads (e.g. `findActiveSessionsByMember`) just return
`Foo[]`. Pagination ≠ every list.

## The `IEntityMapper` contract

The mapper is the adapter package's responsibility, but the port
implicitly depends on it. The contract (from `@efesto-cloud/entity`):

```ts
interface IEntityMapper<E extends IEntity, RAW> {
    from(dto: RAW): E;
    to<P extends keyof RAW = keyof RAW>(
        entity: E,
        options?: { pick?: P[] },
    ): Pick<RAW, P>;
}
```

`RAW` is whatever the adapter's driver stores/returns (a Prisma payload
type, a MongoDB document, a Drizzle row, …) — the port stays unaware of
which.

- **`from`** — stored record → entity. May throw on corrupt data (it's
  an ops issue, not a domain failure).
- **`to`** — entity → stored record. Cannot fail; the entity is already
  valid. The optional `pick` narrows the output to a subset of columns
  (used for partial updates).

See `references/persistence-adapter.md` for full mapper rules (and the
DB's dedicated skill — `prisma-persistence` / `mongodb-persistence` —
for driver-specific record types).

## Population (eager-loading) — when to add it

If callers need to eagerly load related entities (`Foo` with its
`bars`), the port grows an `options.expand` field:

```ts
import type { Expand } from "@efesto-cloud/expand";
import type { FooShape } from "./shape/FooShape.js";

interface IFooRepository {
    findById(
        id: string,
        options?: { includeDeleted?: boolean; expand?: Expand<FooShape> },
    ): Promise<Foo | null>;
    // ...
}

export namespace IFooRepository {
    export type Options = {
        expand?: Expand<FooShape>;
    };
}
```

The `FooShape` type lives at `core/src/repo/shape/FooShape.ts` (or
in the adapter, depending on where the eager-loader lives). See
`references/population.md` for the type system and the DB's dedicated
skill (`prisma-population` / `mongodb-population`, …) for the concrete
eager-loading impl.

## Common methods by aggregate type

| Aggregate kind | Typical methods |
|----------------|-----------------|
| Simple aggregate (Member, Customer) | `findById`, `findByX`, `list`, `save`, `count<X>` |
| Time-bound (TimesheetEntry, Reservation) | `findById`, `listInRange({ from, to })`, `save` |
| Slug / URL-keyed (Article, Page) | `findBySlug`, plus the usual |
| Token / secret-keyed (Session, CalendarFeed) | `findByToken`, with the token having a uniqueness index |
| Hierarchical (Tree, Category) | `listChildren(parent_id)`, `findRoot()`, plus the usual |

The exact verb stays consistent: `findBy<X>` always returns `Foo | null`;
`listX` returns `Foo[]` or `{ items, total }` depending on whether it
paginates.

## Filtering conventions

For `list({ ... })`:

- Pagination fields are required: `limit`, `offset`.
- `includeDeleted` is required (no default — force the caller to
  decide).
- Domain filters are optional. They use the same `snake_case` field
  names as the entity / DTO when possible.
- Free-text search is `q?: string` (case-insensitive substring across
  a documented set of columns; document the columns in the
  interface's JSDoc).
- Ordering is implementation-detail unless the use case needs to
  expose it as a parameter.

## Cross-layer interactions

- **Use case ← port**: constructor-injected via
  `@inject(InternalSymbols.Repo.Foo)`. Calls `findById`, `list`,
  `save`. Maps domain errors from `null` results to
  `FooNotFoundError`.
- **Adapter → port**: implements the interface against the chosen
  database (Prisma / MongoDB / Drizzle / …) or in-memory (`@*/stub`).
  Uses a mapper to bridge `Foo ↔ FooRow`.
- **Composition root → port**: binds the symbol to the implementation
  in the adapter's `install.ts`.

The port itself depends only on:

- The entity class (for return types).
- `core/src/type/` types (for filter shapes).
- `core/src/repo/shape/<X>Shape.ts` (only when population is enabled).
- `@efesto-cloud/expand` (only the `Expand<T>` type, when population is
  enabled).

Nothing else. If your port wants to import from a driver package (a
Prisma client, the MongoDB driver, …) or from any DB-specific
transaction context, you've broken the hexagon. Transactions are
expressed only through the generic `IUnitOfWork` port from
`@efesto-cloud/unit-of-work`, never a concrete database context.

## Checklist — new repo port

- [ ] File `core/src/repo/IFooRepository.ts`.
- [ ] Interface name `I<Entity>Repository`.
- [ ] `findById(id, options?): Promise<Foo | null>`.
- [ ] Additional `findByX(value)` methods for unique-keyed lookups,
      each returning `Foo | null`.
- [ ] `list(filter)` returning `{ items: Foo[]; total: number }`
      with required `limit`, `offset`, `includeDeleted`.
- [ ] `save(entity): Promise<void>` — upsert.
- [ ] `count<X>()` methods where the use cases need a single integer.
- [ ] No `delete(id)` method.
- [ ] No driver types imported (Prisma / MongoDB / Drizzle / any DB
      client or transaction context).
- [ ] Symbol added to `InternalSymbols.Repo.Foo`.
- [ ] Type-only re-export from `core/src/repo/index.ts`.
- [ ] Now follow `references/persistence-adapter.md` for the impl side.

## "Seen in the wild"

- `packages/core/src/repo/IMemberRepository.ts` — full example with
  `findById` (+ `includeDeleted`), `findByEmail`, `findByCode` (the
  documented-exception case), `findByCalendarFeedToken`, paged `list`
  with `q`, and `countAdmins`.
- `packages/core/src/repo/IPraticaRepository.ts` — pagination + domain
  filters.
- `packages/core/src/repo/ITimesheetEntryRepository.ts` — time-bound
  queries (`listInRange`).
