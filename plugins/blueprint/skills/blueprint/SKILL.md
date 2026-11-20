---
name: blueprint
description: How Efesto builds an application — a TypeScript monorepo with a `contract` package, a hexagonal `core`, adapters per technology and apps as composition roots, on better-result, zod, Inversify, pnpm workspaces and Biome. Use it for any task that shapes or extends such a project — starting one, adding or changing a use case, its input schema, an entity, a repository or service port, an adapter, a domain error, a type/enum/dict, an output interface, a DI binding or install, a composition root, the Unit of Work and the save contract, optimistic concurrency, validation at the edge, tests — and for questions like "where does this go", "how do I wire X", "how do two people editing the same thing behave". Triggers even when the user names none of this: "add a feature", "add a field to Foo", "save this", "make this screen call the core" all qualify when the project uses this stack.
---

# Blueprint

This is how we build an application. Every rule here was applied in a real
project first; where we have not decided yet, the skill says so and you ask
the human instead of inventing a rule.

Open the reference for the layer you are touching; don't read them all up
front.

| Touching | Read |
|---|---|
| package layout, imports, build | `references/packages.md` |
| use case interface, input schema, output, registry, type/enum/dict | `references/contract.md` |
| use case implementation, module, composition of use cases | `references/use-case.md` |
| domain errors and how callers show them | `references/errors.md` |
| entity, repository, Unit of Work, versions and conflicts, SQL | `references/persistence.md` |
| container, `install`, adapters, composition root, input at the edge | `references/composition.md` |
| tests | `references/testing.md` |
| anything listed as open | `references/open-questions.md` |

## The shape

```
apps/        composition roots: webapp, Node processes, seed
packages/    contract, core, db (schema and migrations)
adapters/    <technology>-adapter: d1, sqlserver, http, stub
```

- **contract** is what a caller sees or sends: use case interfaces with their
  input schemas, output interfaces, types, enums, dicts, errors, the registry,
  `UseCase<I, R>` and `ExecutionContext`. It depends only on zod and
  better-result, never on the core.
- **core** is the domain and what it needs: entities, pure rules
  (`core/rule/`), use case implementations, ports (repositories, services),
  the DI modules. No technology.
- **adapters** implement the core's ports with one technology each.
- **apps** create the container, load the core and the adapters they chose,
  and call use cases through the resolver.

Dependencies go one way: app → adapter → core and contract; core → contract.
Nobody imports an app; an adapter never imports another adapter.

A port always exists. Its implementation may live in the core (a password
hasher with no dependencies) or in an adapter; moving it is moving a folder.

## Rules that hold everywhere

1. **Use cases have no suffix.** Interface `IApproveExpense` in the contract,
   class `ApproveExpense` in `core/src/useCase/expenses/impl/`, key
   `"expenses.ApproveExpense"`. The key is also the container id.
2. **`UseCase<I, R>` lives in the contract** and has exactly two parameters:
   the input and a better-result `Result`. The context is not generic: it is
   the project's single `ExecutionContext` type, fixed in the signature of
   `execute(input, context)`.
3. **Every use case returns a `Result`**, even when it cannot fail
   (`Result<T, never>`). Success without a value is `Result<void, …>`.
4. **The input is a zod schema in the same file as the interface**, named like
   its type (`ApproveExpenseInput`). The caller validates it at the edge, only
   where raw data enters; the use case never revalidates the shape.
5. **Output is a TypeScript `interface`**: `I<Entity>` in `interface/`, no
   `Dto` suffix, no schema.
6. **Errors are native better-result `TaggedError`s**, tag equal to the class
   name, one file each. In the contract if they appear in a use case's
   `Error`; in the core if a port raises them and the use case handles them;
   infrastructure failures are exceptions.
7. **An entity carries its version `v`; an entity's repository has one
   `save(entity)`, which queues instead of writing.** The Unit of Work writes
   the queue all-or-nothing, retries the work on a conflict, and finally
   returns `ConflictError`. Read `references/persistence.md` before touching
   any write.
8. **The composition root creates the container.** The core exposes
   `install(container)` and `createUseCaseResolver(container)`; every adapter
   exports `install<Technology>(opts): ContainerModule`.
9. **No barrels.** Every package exports `"./*"` and is imported by path.
10. **One symbol per file, `export default`**; only an input's schema and type
    are named exports.

## Out of scope, on purpose

Not decided yet. Do not invent a rule; ask the human, and record what was
decided in the project's ADRs.

- **Authorization**: who may run a use case, policies, permissions.
- **Extensions**: a bus between our own components with swappable channels
  (in-process, Workers RPC, internal HTTP), public gateways (HTTP, MCP), a
  bootstrap shared by several processes.
- **Deferred work**: queues, cron, workflows.

`references/open-questions.md` lists these and the smaller open points, with
what we know so far.

## Language

Code identifiers, error names and use case names are in English. Domain words
may follow the project's language (an Italian project names `Offerta`,
`CreateOfferta`); be consistent inside one project.
