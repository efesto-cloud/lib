---
name: core
description: Self-contained skill for designing and maintaining the `@*/core` package in a hexagonal-architecture TypeScript monorepo built on the `@efesto-cloud/*` libraries (Entity, Result, Maybe, Expand, UnitOfWork, Publisher, Observable, Usecase), Inversify, pnpm workspaces, and Biome. Use this skill on any task that touches the core package or its adapter packages — adding or changing an entity, value object, type/enum/dict, DTO, domain error, repository port, service port, use case, DI binding, module assembly, the composition root, the persistence adapter (the separate package implementing storage against whatever database the project chose — Prisma, MongoDB, Drizzle, …), soft-delete behaviour, population/eager-loading, the `Result`/`Maybe` error-handling pattern, or any question about how the layers fit together. Also use whenever the user asks where a new file should live, how DI/Inversify/Symbols work in this project, what `InternalSymbols` vs `UseCaseSymbols` are for, how `resolveUseCase("…")` gets its types, what an installer/`ContainerModule` is, how the webapp wires everything at boot, how mappers reconstruct value objects, or how soft-delete is enforced. Triggers even when the user does not say "core" — phrases like "add a new feature", "wire up X", "where do I put", "how do I bind", "how does this codebase work" all qualify if the project uses this stack.
---

# Core Skill

Front door for working in a `@*/core` package — the domain heart of a
hexagonal-architecture TypeScript monorepo built on the `@efesto-cloud/*`
libraries, Inversify, pnpm workspaces, Biome, and `nodenext` module
resolution.

This skill is **self-contained**. Every layer you need to touch — entity,
value object, type/enum/dict, DTO, error, repository port, service port,
use case, DI binding, persistence adapter, population — is documented in
`references/`. Open the relevant reference when you start working on that
layer.

The persistence adapter is described **database-agnostically**: core
owns the repository *ports*, and a **separate adapter package**
implements them against whatever database the project chose (Prisma,
MongoDB, Drizzle, …). For concrete driver code, this skill points to the
matching dedicated skill (`prisma-persistence`, `mongodb-persistence`,
…).

---

## When to use

Reach for this skill on any task touching the core package or its
adapters:

- "Add a `Foo` entity" / "add a field to `Bar`" / "rename `Baz`"
- "Add a value object for X" / "validate Y as a domain primitive"
- "Add a use case that does Z" / "I need a new endpoint backed by …"
- "Wire up a new repo / a new service"
- "Where does the mapper go?" / "Why doesn't `resolveUseCase` autocomplete?"
- "Explain how DI is set up here" / "What is `InternalSymbols`?"
- "Add population for Foo's bars" / "make findById eager-load X"
- "Soft-delete is broken" / "show me the soft-delete flow"
- Anything starting with "where do I put …" in this codebase.

Trigger even when the user does not say "core" — anything that
implicates the core package or its surrounding adapters fits.

---

## The package picture

The persistence adapter is shown generically as `@*/persistence-adapter`. The
real package name reflects the chosen database (`@*/prisma-adapter`, `@*/mongodb-adapter`,
`@*/drizzle-adapter`, …) — but core never knows which.

```
┌─────────────────────────────────────────────────────────────┐
│  @efesto-cloud/*  ── Entity · Result · Maybe · Expand       │
│                     UnitOfWork · Publisher · Observable     │
│                     Usecase                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  @*/core        ── Domain: entities, value objects,         │
│                    types/enums/dicts, DTOs, errors          │
│                    Application: use cases                   │
│                    Ports: repository interfaces,            │
│                    service interfaces                       │
│                    DI: InternalSymbols + UseCaseSymbols     │
│                    + per-domain ContainerModules            │
└─────────────────────────────────────────────────────────────┘
                              │
                  ┌───────────┴───────────┐
                  ▼                       ▼
┌──────────────────────────────┐   ┌──────────────────────────┐
│  @*/persistence-adapter      │   │  @*/stub                 │
│  ── DB adapter (Prisma /     │   │  ── in-memory adapters   │
│     Mongo / Drizzle):        │   │     for tests / mocks    │
│     repo impls, mappers,     │   │                          │
│     install() module         │   │                          │
└──────────────────────────────┘   └──────────────────────────┘
                  │                       │
                  └───────────┬───────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  @*/webapp     ── e.g. React Router 7 + Cloudflare Workers  │
│                   container.server.ts is the composition    │
│                   root: initContainer() + installServices() │
│                   + one adapter (installPersistence() or     │
│                   installStub())                            │
└─────────────────────────────────────────────────────────────┘
```

- **`@efesto-cloud/*`** — shared libraries. `Entity` base class, `Result`
  / `Maybe` monads, `Expand<T>` eager-loading types, `IUnitOfWork`
  (transaction port), `Publisher`/`Observable`, `IUseCase`.
- **`@*/core`** — domain + application + ports. Every interface lives
  here. **No knowledge of any DB or framework.**
- **`@*/persistence-adapter`** — the chosen-DB adapter (`@*/prisma-adapter`, `@*/mongodb-adapter`,
  …). `XRepoImpl` + `XMapper` files, exports an `install({ … })`
  `ContainerModule`. Imports core but core does not import it. Concrete
  driver code lives in the database's dedicated skill.
- **`@*/stub`** — in-memory adapter for mock environments and tests.
  Same shape: `install()` returns a `ContainerModule`.
- **`@*/webapp`** — composition root. Boots the container,
  loads core's own modules + one adapter module + services module,
  exposes a typed `resolveUseCase("domain.UseCaseName")` to route
  loaders/actions.

The dependency arrow only points downward. `core` never imports from
the persistence adapter, `stub`, or `webapp`. See
`references/architecture.md`.

---

## The hard rules

Six rules pull their weight everywhere; everything else is detail.

1. **`Result<T, E>` everywhere — never throw.** Domain factories,
   entity mutators, use cases all return `Result`. Throwing escapes the
   type system and bypasses the caller's error-handling. Exceptions
   exist (mapper `from` on corrupted DB rows, `unwrapOrThrow` at the
   HTTP boundary) and are flagged where they apply.
2. **`.js` extensions on every local import.** `nodenext` module
   resolution + `tsc-alias` require it. `import Foo from "~/entity/Foo.js"`
   — even though the source file is `Foo.ts`.
3. **Soft-delete via `entity.delete()` + `repo.save()`.** `delete()`
   sets `deleted_at` to now; `save()` persists the field. There is no
   `repo.delete()`. `findById` filters `deleted_at IS NULL` by default;
   pass `{ includeDeleted: true }` (used only by restore) to opt in.
4. **Use cases never call other use cases.** Shared behaviour goes on
   entities or in a domain service. Calling a peer use case smuggles
   one transaction into another and hides dependencies.
5. **Mappers live in the adapter package, not in core.** Core defines
   the repository interface (port) and what an entity looks like;
   `XMapper.from/to` is database-specific and lives in the persistence
   adapter (`@*/persistence-adapter/src/mapper/`).
6. **Constructor injection only.** `@inject(InternalSymbols.X) private readonly x: IX`.
   No property injection, no `container.get(...)` inside a use case.

The why for each rule is in `references/conventions.md`.

---

## The 12-step recipe for a new feature

You're adding a `Foo` aggregate with a `CreateFoo` use case backed by
the project's persistence adapter. The order matters: each step compiles
on its own and feeds the next.

| # | Step | File(s) | Reference |
|---|------|---------|-----------|
| 1 | Value objects the entity needs | `value_object/FooName.ts` | `references/value-object.md` |
| 2 | Constrained string fields (status, kind, role) | `type/FooStatus.ts` + `enum/FooStatusEnum.ts` + `dict/FooStatusDesc.ts` | `references/type-enum-dict.md` |
| 3 | The entity itself | `entity/Foo.ts` | `references/entity.md` |
| 4 | Its DTO | `dto/FooDto.ts` | `references/dto.md` |
| 5 | Domain errors the entity / use case can return | `errors/FooNotFoundError.ts`, etc. | `references/errors.md` |
| 6 | Repository port (interface) | `repo/IFooRepository.ts` | `references/repository-port.md` |
| 7 | Service ports needed (clock, hasher, …) | already exist; add if new | `references/service-port.md` |
| 8 | Use case interface | `useCase/foos/ICreateFooUseCase.ts` | `references/usecase.md` |
| 9 | Use case impl + binding + registry augmentation | `useCase/foos/impl/CreateFooUseCase.ts` + `useCase/foos/FoosModule.ts` | `references/usecase.md` + `references/di-layer.md` |
| 10 | DI symbol entries | `di/UseCaseSymbols.ts` (new `foos.CreateFoo` entry); `di/InternalSymbols.ts` (new `Repo.Foo` entry) | `references/di-layer.md` |
| 11 | Adapter: repo impl + mapper + installer edit | `@*/persistence-adapter/src/repository/FooRepoImpl.ts` + `@*/persistence-adapter/src/mapper/FooMapper.ts` + edit `@*/persistence-adapter/src/install.ts` | `references/persistence-adapter.md` (+ the DB's dedicated skill: `prisma-persistence` / `mongodb-persistence`) |
| 12 | Route loader / action wiring | `@*/webapp/app/routes/foos/...tsx` calling `context.resolveUseCase("foos.CreateFoo").execute(...)` | `references/composition-root.md` |

A full end-to-end trace with code at every step is in
`references/feature-walkthrough.md`.

---

## Topic index

### Architecture & cross-cutting

| Reference | What it covers |
|-----------|----------------|
| `references/architecture.md` | The three-package picture in depth; what may import what. |
| `references/folder-structure.md` | Canonical `src/` layout with one line per folder. |
| `references/conventions.md` | `.js`, `Result`/`Maybe`, soft-delete, `Europe/Rome`, never-throw, …with the *why* for each. |
| `references/di-layer.md` | `InternalSymbols`, `UseCaseSymbols`, `<Domain>Module.ts`, `UseCaseRegistry` augmentation, scope decisions. **Largest unique value-add.** |
| `references/composition-root.md` | How `webapp/container.server.ts` boots the container, switches between the persistence adapter and stub, exposes `resolveUseCase`. |
| `references/feature-walkthrough.md` | One synthetic `Foo` feature traced through every file the 12-step recipe touches. |

### Domain layer

| Reference | What it covers |
|-----------|----------------|
| `references/entity.md` | `@efesto-cloud/entity` `Entity` base class, `create()` factory, mutators, `toDTO()`, soft-delete, audit fields. |
| `references/value-object.md` | Immutable scalar / composite VOs, `private constructor` + `static create()`, `toRaw()`. |
| `references/type-enum-dict.md` | `T*` string union, `*Enum` runtime record, `*Desc` label map. |
| `references/dto.md` | `<Entity>Dto` shape, marshalling rules, when to use a DTO vs a use-case input/response type. |
| `references/errors.md` | `DomainError` base class, per-condition parameterless subclasses, where to put them. |

### Application layer

| Reference | What it covers |
|-----------|----------------|
| `references/usecase.md` | `IUseCase<I, O>` from `@efesto-cloud/usecase`, `@injectable()` impl, the "load → mutate → save → Result" body, decorators. |
| `references/repository-port.md` | `IFooRepository` interface conventions, return types, the `IEntityMapper<E, R>` contract. |
| `references/service-port.md` | How to design a non-repo port (clock, hasher, codec, mailer): port location vs impl location, scope decisions. |

### Persistence (database-agnostic)

| Reference | What it covers |
|-----------|----------------|
| `references/persistence-adapter.md` | Generic adapter shape: `FooRepoImpl` + `FooMapper`, the `IUnitOfWork` transaction port, soft-delete, installer — DB-agnostic, with pointers to the `prisma-persistence` / `mongodb-persistence` skills for concrete driver code. |
| `references/population.md` | Generic `Expand<T>` / `Shape` eager-loading types — DB-agnostic; links out to the DB's dedicated population skill for the implementation. |

### Error & null handling

| Reference | What it covers |
|-----------|----------------|
| `references/monad-result.md` | `Result<T, E>` from `@efesto-cloud/result`: construction, branching, transforms, serialisation. |
| `references/monad-maybe.md` | `Maybe<T>` from `@efesto-cloud/maybe`: when to prefer over `null`. |

### Reactive primitives

| Reference | What it covers |
|-----------|----------------|
| `references/publisher.md` | `Publisher<ARGS>` — stateless event broadcasting. |
| `references/observer.md` | `IObservable<T>` — stateful reactive value. |

---

## The DI nutshell

Two symbol files split by audience:

- **`di/InternalSymbols.ts`** — repo + service + unit-of-work tokens.
  Consumed by use-case implementations via `@inject(InternalSymbols.Repo.X)`.
  Bound at composition time by the adapter package's `install.ts`.
- **`di/UseCaseSymbols.ts`** — use-case tokens, organised by domain
  (`UseCase.<domain>.<Name>`). Bound by per-feature
  `<Domain>Module.ts` files inside `useCase/<domain>/`.

A type-only registry (`di/UseCaseRegistry.ts`) starts empty. Every
`<Domain>Module.ts` augments it with `declare module
"~/di/UseCaseRegistry.js"` — that's what gives
`resolveUseCase("members.GetMember")` its static return type.

The webapp's composition root calls `initContainer()` (loads core's
modules), then `container.load(installServices(), installPersistence({…}))`
— where `installPersistence` is the chosen adapter's installer — to bind
the adapters, then creates a typed resolver with
`createUseCaseResolver(container)`.

Full story in `references/di-layer.md` and `references/composition-root.md`.

---

## How to use the references

Open them on demand. Don't read everything up-front — each reference is
self-contained and focuses on its layer. The cross-references between
references go to other files under `references/`, never out to a
separate skill.
