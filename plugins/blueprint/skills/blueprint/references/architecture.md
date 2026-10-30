# Architecture

The three-package picture in depth — what each package owns, what it
may import, and why.

## The dependency arrow only points down

```
@efesto-cloud/*  ──→  @*/core  ──→  @*/prisma  ──→  @*/webapp
                                    @*/stub    ──→  @*/webapp
```

- `@*/core` may import from `@efesto-cloud/*` and nothing else inside
  the monorepo.
- `@*/prisma` and `@*/stub` import from `@efesto-cloud/*` and `@*/core`.
- `@*/webapp` imports from `@efesto-cloud/*`, `@*/core`, and **either**
  `@*/prisma` **or** `@*/stub` (it loads one of them at runtime based
  on environment).

Reverse arrows are forbidden. `core` knowing about `prisma` would
collapse the hexagon: the whole point is that `core` describes what
storage does, not how. The same goes for `core` importing from the
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
- **`@efesto-cloud/population`** — `Populate<T>`, `NormalizedPopulate<T>`,
  `normalizePopulate()`.
- **`@efesto-cloud/prisma-database-context`** — `IPrismaContext<TClient>`
  + `PrismaContext` implementation; provides `this.db.client` and
  `runWithTransaction()`.
- **`@efesto-cloud/prisma-population`** — `BasePrismaPopulator<Shape>`,
  `toPrismaInclude()`.
- **`@efesto-cloud/publisher`** — fire-and-forget event broadcaster.
- **`@efesto-cloud/observable`** — stateful observable.
- **`@efesto-cloud/usecase`** — `IUseCase<I, O>` interface.

You install these as `dependencies` of `@*/core` (or the adapter
packages, for `@efesto-cloud/prisma-database-context`).

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

### `@*/prisma` (the active persistence adapter)

Implements every repo port with Prisma. Three folder families:

- `src/repository/` — one `<Entity>RepoImpl` per repo port.
- `src/mapper/` — one `<Entity>Mapper` per entity (lives here, not in
  core).
- `src/repository/populate/` and `src/repository/shape/` — Prisma
  populators and per-entity Shape types.
- `src/install.ts` — exports a default function that returns a
  `ContainerModule` binding all repo impls + `IPrismaContext` to their
  symbols (the symbols imported from `@*/core`).
- `src/PrismaSymbols.ts` — package-private symbol(s) the installer
  needs that aren't in `InternalSymbols` (e.g. `PrismaClientSymbol`).

### `@*/stub` (the in-memory adapter)

Same shape as `@*/prisma`: an `install()` function returning a
`ContainerModule` that binds the same `InternalSymbols.Repo.X` keys to
in-memory implementations. Used by the webapp when `NODE_ENV === "mock"`
and by tests.

### `@*/webapp` (the composition root)

Holds the runtime entry point. Two files do almost all the wiring:

- `app/container.server.ts` — `bootContainer()`, `getResolveUseCase()`.
  Calls `initContainer()` (core), then `container.load(installServices(),
  useMock ? installStub() : installPrisma({ DB: env.DB }))`.
- `workers/app.ts` — Cloudflare Worker entry point. Augments
  `AppLoadContext` with `resolveUseCase: UseCaseResolver` so every
  route loader/action can call it.

Routes call `context.resolveUseCase("members.GetMember").execute(input)`.
They never reach into the container directly.

## Why ports live in core and impls live in adapters

The point of hexagonal architecture is **swappability**. The same use
case (`CreateMemberUseCase`) runs identically against:

- Production: `installPrisma({ DB: env.DB })` — Prisma + D1.
- Mock preview: `installStub()` — in-memory `Map`s seeded from
  fixtures.
- Tests: `installStub()` — same in-memory adapter, with a fresh seed
  per test.

If the use case knew about Prisma, you couldn't run it under the stub.
The repo interface is the contract; everything else negotiates with
that contract.

## Why the webapp is the composition root

Only the webapp knows what environment it runs in — Cloudflare Workers
with D1, Node with a local Postgres, a test harness with in-memory
fakes. The composition decision (which adapter to load, which Prisma
client to construct) has to happen as late as possible, in the only
package that has the environment context.

`core` is allowed to build a partial container (its own use-case
modules, the pure services) because those bindings are environment-
independent. Everything else waits for `container.load(…)` in
`container.server.ts`.

## "Seen in the wild"

In the `task-planning` repo, the active stack is:

- Core: `/Users/dario/thera-capital/task-planning/packages/core/`
- Active persistence: `/Users/dario/thera-capital/task-planning/packages/prisma/`
- Mock adapter: `/Users/dario/thera-capital/task-planning/packages/stub/`
- Webapp / composition root:
  `/Users/dario/thera-capital/task-planning/packages/webapp/`
- Composition root file: `packages/webapp/app/container.server.ts`
- Worker entry: `packages/webapp/workers/app.ts`

There is also a `packages/drizzle` folder; it is an excluded
experiment and not part of the dependency graph. The project root's
`CLAUDE.md` documents this explicitly.
