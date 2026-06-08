# Architecture

The package picture in depth — what each package owns, what it may
import, and why.

The persistence adapter is shown generically as `@*/persistence-adapter`. The
concrete package is whatever database the project chose — `@*/prisma-adapter`,
`@*/mongodb-adapter`, `@*/drizzle-adapter`, … — and the choice never leaks into core.

## The dependency arrow only points down

```
@efesto-cloud/*  ──→  @*/core  ──→  @*/persistence-adapter  ──→  @*/webapp
                                    @*/stub         ──→  @*/webapp
```

- `@*/core` may import from `@efesto-cloud/*` and nothing else inside
  the monorepo.
- `@*/persistence-adapter` (the chosen DB adapter) and `@*/stub` import from
  `@efesto-cloud/*` and `@*/core`.
- `@*/webapp` imports from `@efesto-cloud/*`, `@*/core`, and **one**
  adapter — the active `@*/persistence-adapter` **or** `@*/stub` (it loads one
  of them at runtime based on environment).

Reverse arrows are forbidden. `core` knowing about the database adapter
would collapse the hexagon: the whole point is that `core` describes
what storage does, not how. The same goes for `core` importing from the
webapp.

This isn't enforced by tooling — it's enforced by reviewer attention
and by the fact that any reverse import will create a typescript cycle
that the build catches.

## What lives in each package

### `@efesto-cloud/*` (external libraries)

Reusable, project-independent building blocks. Notable members:

- **`@efesto-cloud/entity`** — `Entity<Props, Id>` base class, `IEntity`,
  `IEntityMapper<E, R>`, soft-delete (`delete()`, `restore()`,
  `isDeleted()`), `_touch(clock)`.
- **`@efesto-cloud/result`** — `Result<T, E>` monad.
- **`@efesto-cloud/maybe`** — `Maybe<T>` monad.
- **`@efesto-cloud/expand`** — `Expand<T>`, `NormalizedExpand`,
  `normalizeExpand()` (database-agnostic eager-loading / population spec).
- **`@efesto-cloud/unit-of-work`** — `IUnitOfWork` transaction port
  (`runWithTransaction()`). Core depends on this generic port; the
  database-specific implementation
  (`@efesto-cloud/prisma-unit-of-work`, `@efesto-cloud/mongodb-unit-of-work`)
  is a dependency of the adapter package, not core.
- **`@efesto-cloud/publisher`** — fire-and-forget event broadcaster.
- **`@efesto-cloud/observable`** — stateful observable.
- **`@efesto-cloud/usecase`** — `IUseCase<I, O>` interface.

You install these as `dependencies` of `@*/core` (the
database-specific unit-of-work and eager-loading packages are
dependencies of the adapter package instead).

### `@*/core` (the domain)

The hexagon's core. Six folder families:

- `entity/`, `value_object/`, `type/`, `enum/`, `dict/`, `dto/`,
  `errors/` — pure domain shapes and rules.
- `repo/` — **port** interfaces (`IFooRepository`). No impls.
- `service/` — **port** interfaces (`IClock`, `IPasswordHasher`,
  `IMemberAuthenticator`, …) plus pure impls (`LuxonClock`,
  `ScryptPasswordHasher`) that have no external I/O.
- `useCase/<domain>/` — interface + impl + per-domain `ContainerModule`.
- `di/` — `InternalSymbols.ts`, `UseCaseSymbols.ts`,
  `UseCaseRegistry.ts`, `resolveUseCase.ts`, `container.ts`.
- `util/` — pure helpers (code generation, validation predicates).

Core also publishes the `installServices()` `ContainerModule` for pure
services that depend on Node-only crypto (e.g. `ScryptPasswordHasher`)
— this can't be auto-loaded by core itself because the platform
choice (Node, Workers, …) belongs to the composition root.

### `@*/persistence-adapter` (the active persistence adapter)

Implements every repo port against the chosen database. The package
name reflects the database (`@*/prisma-adapter`, `@*/mongodb-adapter`, `@*/drizzle-adapter`, …),
but the shape is identical regardless of driver. Folder families:

- `src/repository/` — one `<Entity>RepoImpl` per repo port.
- `src/mapper/` — one `<Entity>Mapper` per entity (lives here, not in
  core).
- `src/repository/populate/` and `src/repository/shape/` — the
  adapter's eager-loading components and per-entity Shape types.
- `src/install.ts` — exports a default function that returns a
  `ContainerModule` binding all repo impls + the unit-of-work
  implementation to their symbols (the symbols imported from `@*/core`).
- a package-private symbols file for any token the installer needs that
  isn't in `InternalSymbols` (e.g. the raw DB-client token).

For the concrete driver code, follow the database's dedicated skill
(`prisma-persistence`, `mongodb-persistence`, …). The generic adapter
shape is in `references/persistence-adapter.md`.

### `@*/stub` (the in-memory adapter)

Same shape as `@*/persistence-adapter`: an `install()` function returning a
`ContainerModule` that binds the same `InternalSymbols.Repo.X` keys to
in-memory implementations. Used by the webapp when `NODE_ENV === "mock"`
and by tests.

### `@*/webapp` (the composition root)

Holds the runtime entry point. Two files do almost all the wiring:

- `app/container.server.ts` — `bootContainer()`, `getResolveUseCase()`.
  Calls `initContainer()` (core), then `container.load(installServices(),
  useMock ? installStub() : installPersistence({ DB: env.DB }))` — where
  `installPersistence` is the chosen adapter's installer (e.g.
  `installPrisma` / `installMongo`).
- `workers/app.ts` — Cloudflare Worker entry point. Augments
  `AppLoadContext` with `resolveUseCase: UseCaseResolver` so every
  route loader/action can call it.

Routes call `context.resolveUseCase("members.GetMember").execute(input)`.
They never reach into the container directly.

## Why ports live in core and impls live in adapters

The point of hexagonal architecture is **swappability**. The same use
case (`CreateMemberUseCase`) runs identically against:

- Production: the chosen adapter's installer, e.g.
  `installPrisma({ DB: env.DB })` or `installMongo({ uri })`.
- Mock preview: `installStub()` — in-memory `Map`s seeded from
  fixtures.
- Tests: `installStub()` — same in-memory adapter, with a fresh seed
  per test.

If the use case knew about the database, you couldn't run it under the
stub. The repo interface is the contract; everything else negotiates
with that contract.

## Why the webapp is the composition root

Only the webapp knows what environment it runs in — Cloudflare Workers
with D1, Node with a local Postgres, a MongoDB cluster, a test harness
with in-memory fakes. The composition decision (which adapter to load,
which DB client to construct) has to happen as late as possible, in the
only package that has the environment context.

`core` is allowed to build a partial container (its own use-case
modules, the pure services) because those bindings are environment-
independent. Everything else waits for `container.load(…)` in
`container.server.ts`.

## "Seen in the wild"

A typical stack lays out the packages as:

- Core: `packages/core/`
- Active persistence: `packages/<db>/` — the adapter for the chosen
  database (e.g. `packages/prisma-adapter/` or `packages/mongodb-adapter/`).
- Mock adapter: `packages/stub/`
- Webapp / composition root: `packages/webapp/`
- Composition root file: `packages/webapp/app/container.server.ts`
- Worker / server entry: `packages/webapp/workers/app.ts`

A repo may carry more than one adapter package (e.g. a `packages/prisma`
in use plus an experimental `packages/drizzle`); only the one the
composition root loads is part of the live dependency graph. The
project root's `CLAUDE.md` documents which is active.
