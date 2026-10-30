---
name: blueprint
description: How Efesto builds an application so it stays elastic and future-proof — a hexagonal TypeScript monorepo on the `@efesto-cloud/*` libraries (entity, result, maybe, tagged-error, result-codec, usecase, expand, unit-of-work, publisher, observable), Inversify, pnpm workspaces and Biome, grown one rung at a time from a single package up to a core with adapters and a typed command API. Use it for any task that shapes or extends such a project — starting one, deciding how modular it should be, adding or changing an entity, value object, type/enum/dict, DTO, domain error, repository or service port, use case, adapter, DI binding, composition root, bootstrap package, API command or operation, policy, stub, test fixture, persistence mapper or eager-loading — and for questions like "where does this go", "how do I wire X", "should this be its own package", "do we need an API", "how does this codebase fit together". Triggers even when the user names none of this: "add a feature", "add a field to Foo", "expose this to the other app", "make it work in mock mode" all qualify when the project uses this stack.
---

# Blueprint

This is how we want an application to be built. The aim is **elasticity**:
the project starts as small as the problem allows, and when the problem
grows it climbs to the next shape *without being rewritten*. Nothing here
is about being modular for its own sake; every rule either keeps the next
rung reachable or makes the current one cheaper to live in.

Everything you need is in `references/`. Open the one for the layer you are
touching; don't read them all up front.

---

## The idea in one page: two axes, climbed on signals

A project has two independent dimensions, and each is a ladder. You climb a
rung when its **signal** shows up — not before, because each rung costs
packages and wiring — and the rules below are what make climbing a
refactor instead of a rewrite.

**Axis 1 — how modular it is inside.**

| Rung | Shape | Climb when |
|---|---|---|
| 1 | One package, logic inside the app | — the start for a proof of concept or a small self-contained Worker |
| 2 | + a `core` package holding all domain and application logic | the logic outlives the first screen, or a second consumer (job, CLI, test) needs it |
| 3 | + one package per adapter under `adapters/`, plus a stub adapter | you need tests without infrastructure, a navigable mock before the backend exists, or freedom to swap a vendor |

**Axis 2 — how use cases reach their clients.**

| Rung | Shape | Climb when |
|---|---|---|
| A | **Backend for frontend**: the webapp is the composition root, loaders call `resolveUseCase` | — the start: one client |
| B | **Shared bootstrap**: the wiring moves to a `bootstrap` package used by several deployables | more processes on the same core — a second webapp, a queue consumer, a cron |
| C | **Single API**: a typed command contract (`api`) and its server (`api-server`) with operations, decorators and mandatory policy, behind a transport | several clients that must not own the data, different permissions per client, non-JS clients (CLI, MCP, agents) |

The axes are nearly independent: rung 3 with rung A is the common case;
rung C without rung 3 is possible but rare. No rung is "the real
architecture" — the right one is the lowest that answers today's signals.
Full discussion, costs and the climbing moves: `references/growth.md`.

### What keeps the next rung open

These cost almost nothing on day one and are what make the ladder
climbable. Follow them even on rung 1:

- **Logic lives in use cases, not in loaders or components.** A loader
  that computes is a use case that can't be reused.
- **Use cases take one input object and an execution context**:
  `execute(input, { actor })`. Never positional arguments, never the
  request. That is the shape a command, a CLI flag set and an MCP tool all
  map onto.
- **Anything outside the process is a port.** Database, mail, queue, clock,
  token signer, file codec. A port with one implementation is still a port;
  it is what the stub and the tests plug into.
- **Errors are values.** `Result<T, E>` with named error types. An error you
  can name survives a transport; an exception doesn't.
- **What a browser may import is a separate entry point** (`core/client`):
  types, DTOs, dicts, pure helpers. It is the seed of the API contract.

---

## The shape at full height

```
packages/                                         adapters/
  core          domain + use cases + ports          prisma-adapter     repos + mappers
    ├─ ./client   browser-safe: DTOs, types, dicts  stub-adapter       in-memory fakes + seed
    └─ .          server: container, use cases      <vendor>-adapter   mail, queue, token, codec…
  bootstrap     the composition root, mock or real
  api           commands + session type  (zod + core/client only)
  api-server    operations, decorators, buildSession, ./in-process, ./testing
  <app>-webapp  React Router; imports `api` (rung C) or `bootstrap` (rung B)
```

Dependencies point one way: apps → `api` / `bootstrap` → `core` ← adapters.
`core` imports nothing concrete. `adapters/` is only a folder convention —
packages import each other by name, so moving one never touches an import.
Details: `references/architecture.md`, `references/folder-structure.md`.

---

## The hard rules

1. **`Result<T, E>` everywhere — never throw** for anything the caller should
   handle. Factories, mutators, use cases all return `Result`. Throwing is
   for broken invariants (a corrupt row in a mapper) and for the outermost
   boundary.
2. **Core knows no technology.** No database, framework, vendor SDK or
   runtime global in `core`. If it talks to the outside, it is a port.
3. **Use cases never call use cases.** Shared behaviour goes on the entity,
   in a pure function, or behind a domain service port.
4. **Authorization lives at the edge, never in use cases.** The actor
   arrives in the execution context; *whether* they may call the operation
   is the API policy's job (rung C) or the route's (rung A/B).
5. **Inputs are objects.** `{ id, month, percent }`, never `(id, month, percent)`.
6. **Names without suffix.** Interface `IGetFoo`, implementation `GetFoo`,
   files with the same names, DI key `"<domain>.GetFoo"`. No `UseCase`
   suffix anywhere.
7. **Every port has a stub.** The stub adapter implements every port in
   memory, so the app runs end to end with no infrastructure (mock mode)
   and use cases are tested against it.
8. **Mappers live in the adapter**, not in core. Core defines the port and
   the entity; the row shape belongs to the database.
9. **Soft-delete via `entity.delete()` + `repo.save()`.** No
   `repo.delete()`. Repositories hide deleted rows on reads unless asked.
10. **Constructor injection only.** No `container.get` inside a use case.
11. **`.js` extensions on every relative import** — `nodenext` requires it.

The *why* of each, and the softer conventions: `references/conventions.md`.

---

## Adding a feature

You are adding a `Foo` aggregate with a `CreateFoo` use case. Each step
compiles on its own and feeds the next.

| # | Step | Where | Reference |
|---|---|---|---|
| 1 | Value objects the entity needs | `core/src/value_object/` | `value-object.md` |
| 2 | Constrained strings (status, kind) | `core/src/type/` + `enum/` + `dict/` | `type-enum-dict.md` |
| 3 | The entity | `core/src/entity/Foo.ts` | `entity.md` |
| 4 | Its DTO | `core/src/dto/FooDto.ts` | `dto.md` |
| 5 | Domain errors | `core/src/errors/` | `errors.md` |
| 6 | Repository port | `core/src/repo/IFooRepository.ts` | `repository-port.md` |
| 7 | Service ports, if new | `core/src/service/` | `service-port.md` |
| 8 | Use case interface + impl | `core/src/useCase/foos/ICreateFoo.ts` + `impl/CreateFoo.ts` | `usecase.md` |
| 9 | DI: symbols, module, registry | `core/src/di/`, `useCase/foos/FoosModule.ts` | `di-layer.md` |
| 10 | Stub repo + seed | `adapters/stub-adapter/` | `testing.md` |
| 11 | Use case test against the stub | `core/src/useCase/foos/test/` | `testing.md` |
| 12 | Real adapter: repo impl + mapper | `adapters/prisma-adapter/` | `prisma-persistence.md` |
| 13 | Expose it: route (rung A/B) or command + operation (rung C) | app routes, or `api` + `api-server` | `composition-root.md`, `api.md` |

The same feature traced through every file: `references/feature-walkthrough.md`.

---

## Topic index

**Shape and growth**

| Reference | Covers |
|---|---|
| `growth.md` | The two axes, every rung, its signal, its cost, and how to climb |
| `architecture.md` | Packages, what may import what, `core/client` vs server entry |
| `folder-structure.md` | Canonical layout of `core/src` and of the repo |
| `conventions.md` | The hard rules with their *why*, naming, locale, keeping docs right |

**Domain**

| Reference | Covers |
|---|---|
| `entity.md` | `Entity` base, `create()` factory, mutators, `toDTO()`, soft-delete |
| `value-object.md` | Private constructor, `static create(): Result`, `toRaw()` |
| `type-enum-dict.md` | String union, runtime enum, label dict |
| `dto.md` | DTO shape, `interface` + `namespace`, DTO vs use-case I/O |
| `errors.md` | Domain errors as tagged errors, one per condition, exhaustive matching |

**Application and wiring**

| Reference | Covers |
|---|---|
| `usecase.md` | `IUseCase<I, O>`, execution context, load → mutate → save, transactions, plan/apply |
| `repository-port.md` | Repository interface conventions, pagination, deleted filter |
| `service-port.md` | Non-repo ports: clock, mailer, queue, token, codec |
| `di-layer.md` | `InternalSymbols`, `UseCaseSymbols`, modules, `UseCaseRegistry`, why it collapses to `never` |
| `composition-root.md` | Rung A (webapp root) and rung B (`bootstrap`), mock vs real |
| `api.md` | Rung C: commands, operations, decorators, policy, session, contract tests |
| `testing.md` | Fixtures, in-memory repos as port oracles, contract tests, plan/apply tests |
| `feature-walkthrough.md` | One feature end to end |

**Persistence**

| Reference | Covers |
|---|---|
| `prisma-persistence.md` | Repo impl + mapper, `IPrismaContext`, unit of work, soft-delete |
| `expand.md` | Eager loading: `Expand<T>`, shapes, `normalizeExpand()` — DB-agnostic |
| `prisma-expand.md` | The Prisma expander, `include` generation, mapper/repo patches |

**Values and reactivity**

| Reference | Covers |
|---|---|
| `result.md` | `Result<T, E>`: construction, branching, combinators, async |
| `maybe.md` | `Maybe<T>`, and when `Foo \| null` is the better choice |
| `result-codec.md` | Sending a `Result` across a boundary and back |
| `publisher.md` | `Publisher<ARGS>`: stateless events |
| `observer.md` | `IObservable<T>`: stateful reactive values |

References link only to each other, never to another skill.
