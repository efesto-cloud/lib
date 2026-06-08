# Folder structure

Canonical layout for a `@*/core` package and its adapter siblings.
One line per folder on what it holds, with a sample filename.

## `@*/core/src/`

```
src/
├── client.ts                 — public export surface for browser code
├── server.ts                 — public export surface for server code +
│                               global Luxon settings (locale, zone)
│
├── entity/
│   ├── Foo.ts                — Entity<FooProps, string> subclass
│   └── index.ts              — barrel: `export { default as Foo }`
│
├── value_object/
│   ├── EmailAddress.ts       — private constructor + static create()
│   └── index.ts
│
├── type/
│   ├── TMemberRole.ts        — `type TMemberRole = "admin" | "standard"`
│   └── index.ts              — type-only re-exports
│
├── enum/
│   ├── MemberRoleEnum.ts     — `{ [K in TMemberRole]: K }`
│   └── index.ts
│
├── dict/
│   ├── MemberRoleDesc.ts     — `{ [K in TMemberRole]: string }` (labels)
│   └── index.ts
│
├── dto/
│   ├── MemberDto.ts          — public data shape mirroring the entity
│   └── index.ts              — type-only re-exports
│
├── errors/
│   ├── DomainError.ts        — abstract base
│   ├── FooNotFoundError.ts   — one class per error condition
│   └── index.ts
│
├── repo/
│   ├── IFooRepository.ts     — port interface (no impl here)
│   └── index.ts
│
├── service/
│   ├── IClock.ts             — port interface
│   ├── IPasswordHasher.ts
│   ├── ServicesModule.ts     — ContainerModule binding pure services
│   ├── impl/
│   │   ├── LuxonClock.ts     — pure impl, OK to live in core
│   │   ├── ScryptPasswordHasher.ts
│   │   ├── installServices.ts — additional ContainerModule for impls
│   │   │                       that the webapp opts into explicitly
│   │   └── index.ts
│   └── index.ts
│
├── useCase/
│   └── <domain>/             — e.g. members/, pratiche/, customers/
│       ├── ICreateFooUseCase.ts        — interface
│       ├── IGetFooUseCase.ts
│       ├── FoosModule.ts               — ContainerModule + registry
│       │                                 augmentation for this domain
│       ├── impl/
│       │   ├── CreateFooUseCase.ts     — @injectable() impl
│       │   └── GetFooUseCase.ts
│       ├── test/                       — per-use-case unit tests
│       └── index.ts                    — type-only re-exports of
│                                         the interfaces
│
├── util/
│   ├── isStrongPassword.ts   — pure helpers
│   ├── memberCodeBase.ts
│   └── index.ts
│
├── di/
│   ├── InternalSymbols.ts    — repo + service + DB-context symbols
│   ├── UseCaseSymbols.ts     — use-case symbols (UseCase.<domain>.<N>)
│   ├── UseCaseRegistry.ts    — empty interface, augmented by modules
│   ├── resolveUseCase.ts     — createUseCaseResolver(container)
│   └── container.ts          — singleton container + initContainer()
│
└── logger/
    └── logger.ts             — thin wrapper, optional
```

## `@*/prisma/src/`

```
src/
├── install.ts                — exports `install({ DB })` returning
│                                ContainerModule with all repo bindings
│                                + IPrismaContext binding
├── PrismaSymbols.ts          — `PrismaClientSymbol` (package-private)
│
├── mapper/
│   ├── FooMapper.ts          — IEntityMapper<Foo, FooRow>
│   └── index.ts              — usually not exported externally
│
└── repository/
    ├── FooRepoImpl.ts        — @injectable() implementing IFooRepository
    └── (optional) populate/, shape/  — for population
```

Mappers and impls **live here**, never in `@*/core`. The repo
interface (`IFooRepository`) lives in `@*/core/src/repo/`.

## `@*/stub/src/`

```
src/
├── install.ts                — `install()` returning ContainerModule
│                                with in-memory repo bindings
└── repository/
    └── InMemoryFooRepo.ts    — @injectable() implementing IFooRepository
```

Same `InternalSymbols.Repo.Foo` keys as Prisma; the impls just live
in `Map`s.

## `@*/webapp/`

```
app/
├── container.server.ts       — composition root: bootContainer(),
│                                getResolveUseCase()
├── routes/
│   └── <domain>/
│       └── <route>.tsx       — loader/action call
│                                context.resolveUseCase("…")
└── ...
workers/
└── app.ts                    — Cloudflare Worker entry; augments
                                AppLoadContext with resolveUseCase
```

## What goes where — file → folder cheat-sheet

| Artefact | Folder | Reference |
|----------|--------|-----------|
| Domain entity | `core/src/entity/` | `entity.md` |
| Value object | `core/src/value_object/` | `value-object.md` |
| String-union type | `core/src/type/` | `type-enum-dict.md` |
| Runtime enum object | `core/src/enum/` | `type-enum-dict.md` |
| Label / mapping dict | `core/src/dict/` | `type-enum-dict.md` |
| DTO interface | `core/src/dto/` | `dto.md` |
| Domain error class | `core/src/errors/` | `errors.md` |
| Repo interface | `core/src/repo/` | `repository-port.md` |
| Service port interface | `core/src/service/` | `service-port.md` |
| Service impl (pure) | `core/src/service/impl/` | `service-port.md` |
| Service impl (impure / I/O) | `<adapter>/src/...` (e.g. a new adapter pkg) | `service-port.md` |
| Use case interface | `core/src/useCase/<domain>/` | `usecase.md` |
| Use case impl | `core/src/useCase/<domain>/impl/` | `usecase.md` |
| Per-domain container module | `core/src/useCase/<domain>/<Domain>Module.ts` | `di-layer.md` |
| Symbol | `core/src/di/InternalSymbols.ts` (repo/service) or `UseCaseSymbols.ts` (use case) | `di-layer.md` |
| Repo impl (Prisma) | `prisma/src/repository/` | `prisma-persistence.md` |
| Mapper | `prisma/src/mapper/` | `prisma-persistence.md` |
| Populator | `prisma/src/repository/populate/` | `prisma-population.md` |
| Shape type | `prisma/src/repository/shape/` (or `core/src/repo/shape/` if you reuse across adapters) | `population.md` |
| Route loader/action | `webapp/app/routes/<domain>/…` | `composition-root.md` |
| Container bootstrap | `webapp/app/container.server.ts` | `composition-root.md` |

## Naming conventions

- **Entity files** — PascalCase singular (`Member.ts`, not `Members.ts`).
- **DTO files** — `<Entity>Dto.ts` (PascalCase). Some older codebases
  use `I<Entity>.ts`; match the project. Members of the DTO are
  `snake_case`.
- **Type files** — `T<Name>.ts`, default-export the type.
- **Enum files** — `<Name>Enum.ts`.
- **Dict files** — `<Name>Desc.ts` for labels;
  `<Target>From<Source>.ts` for non-label mappings.
- **Error files** — `<Condition>Error.ts`, always ending `Error`.
- **Repo interface** — `I<Entity>Repository.ts`.
- **Use case interface** — `I<Verb><Entity>UseCase.ts`
  (e.g. `ICreateMemberUseCase.ts`, `IListMembersUseCase.ts`).
- **Use case impl** — drop the `I`: `<Verb><Entity>UseCase.ts`.
- **Module file** — `<Domain>Module.ts` (PascalCase, plural domain
  name).
- **Service interface** — `I<Capability>.ts` (e.g. `IClock.ts`,
  `IPasswordHasher.ts`).

## `core` package's `index.ts` barrels

- `entity/index.ts` — `export { default as Foo } from "./Foo.js"`
- `dto/index.ts` — `export type { default as FooDto } from "./FooDto.js"` (type-only)
- `errors/index.ts` — `export { default as FooNotFoundError } from "./FooNotFoundError.js"`
- `repo/index.ts` — `export type { default as IFooRepository } from "./IFooRepository.js"` (type-only — adapters import the interface as a type)
- `service/index.ts` — `export type { default as IClock } from "./IClock.js"`
- `service/impl/index.ts` — `export { default as LuxonClock } from "./LuxonClock.js"`
- `type/index.ts` / `enum/index.ts` / `dict/index.ts` — re-export
  types or values as appropriate.

`server.ts` re-exports each of these via `export * from "./<dir>/index.js"`.
The split between `server.ts` (Node / Workers) and `client.ts`
(browser-safe) matters when some core code imports Node built-ins
(`node:crypto`); see `references/conventions.md` for the rule.
