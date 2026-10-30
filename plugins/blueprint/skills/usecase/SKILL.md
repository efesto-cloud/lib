---
name: usecase
description: >
  Create, update, or maintain use cases in the core package of a hexagonal architecture TypeScript
  monorepo. Use this skill whenever the user asks to add a new use case, implement a new business
  operation, add a feature that touches the application layer, wire up a new endpoint to business
  logic, or update an existing use case's behavior, inputs, or outputs. Trigger on: "create a use
  case for X", "add a feature that does Y", "I need a new operation", "implement the logic for Z",
  "update use case X", "how do I add a use case", or whenever someone needs to create or edit the
  interface, implementation, symbol, or DI binding for a use case. Also trigger when someone says
  "add an action", "implement a command/query", or describes a new business operation that needs
  to interact with repositories or services.
---

# Use Case Skill

**Installation:** If not already installed, add the package with `pnpm add @efesto-cloud/usecase`.

Use cases are the application layer's entry points in a hexagonal architecture. They orchestrate
domain entities, repositories (persistence), and services (email, auth, storage, etc.) to execute
a single well-defined business operation.

Each use case ships four artifacts:
1. **Interface** — `useCase/{domain}/I{Name}.ts` — the type contract
2. **Implementation** — `useCase/{domain}/impl/{Name}.ts` — the class
3. **Symbol** — `di/Symbols.ts` — a new symbol entry
4. **Binding** — `di/container.ts` — a DI binding line

Read `references/templates.md` for ready-to-copy code templates.

## Before You Start

Gather context if the user hasn't already provided it:

- **What does it do?** Understand the operation in plain language (create / update / delete / fetch / search / export…)
- **Authentication:** Does it require a logged-in actor? Which auth type? (operator only, business entity only, dual/both, public/no auth)
- **Mutation vs read:** Does it write data? If yes, it may need a transaction (see
  *Transactions* below). If no, it needs neither.
- **Does the change need a history?** If the business has to answer *who changed
  this, when, and from what to what*, that history is a **domain artifact** — an
  entity (`FooStatusChange`, appended by the use case) or an outbox event — with
  its own schema, queryable by the app. It is not a cross-cutting decorator. Decide
  this now, because it adds a repository and a write to the use case body.
- **Existing repos/services:** What persistence or services does it need? Are they already defined? If a new repo method is needed, use the `/persistence` skill first.
- **New entity needed?** If the domain entity doesn't exist yet, use the `/entity` skill first.
- **Return type:** What does the caller get back on success, and which errors can it return?

## Step 1 — Interface

Create `useCase/{domain}/I{Name}.ts`. See [references/templates.md](./references/templates.md) for
all four auth-variant examples (operator, business entity, dual, no auth).

Rules:
- The input is always `With{Auth}<YourPayload>`. If no auth is required, the payload is a plain object.
- The return type is always `Result<SuccessType, UnionOfErrors>`.
- Import DTOs (not raw entities) for the success type.
- Keep payload types inline for simplicity; extract named types only when they're large or reused elsewhere.

Then add a **type-only** re-export to `useCase/{domain}/index.ts`:

```ts
export type { default as IMyUseCase } from "./IMyUseCase.js";
```

If this is a brand-new domain, also export the `index.ts` from the package's `server.ts`:

```ts
export * from "./useCase/{domain}/index.js";
```

## Step 2 — Implementation

Create `useCase/{domain}/impl/{Name}.ts`. See [references/templates.md](./references/templates.md)
for ready-to-copy implementations of CREATE, UPDATE, DELETE, GET, and SEARCH.

The shape depends on whether the use case mutates data:

### Mutating (CREATE / UPDATE / DELETE / ADD / REMOVE / PUBLISH…)

Wrap the body with the project's auth mechanism. Whether it also needs a
transaction is a separate question — answer it with the test below, not by habit.

### Read-only (GET / SEARCH / EXPORT…)

No transaction, unless the operation has side effects or needs a consistent snapshot.

### Transactions — ask first, wrap second

**The test: does this use case perform two or more writes that must land or fail
together?**

- **No** (one `repo.save()`, however much validation precedes it) → **no
  transaction**. A single write is already atomic. Wrapping it buys nothing and
  costs a connection held open plus a layer of indirection to read past. Most
  CREATE / UPDATE / DELETE use cases are in this bucket.
- **Yes** (entity + its history row, parent + children, two aggregates that must
  agree) → inject `IUnitOfWork` from `@efesto-cloud/unit-of-work` and wrap **only
  the writes**:

```ts
constructor(
  @inject(InternalSymbols.DatabaseContext) readonly db: IUnitOfWork,
  // …repos
) {}

// …load and validate out here, where nothing is holding a transaction open…

await this.db.runWithTransaction(async () => {
  await this.fooRepo.save(foo);
  await this.historyRepo.append(change);
});
```

`IUnitOfWork` is a one-method port — `runWithTransaction<T>(fn) => Promise<T>` —
so core never learns whether the adapter behind it is a Mongo session, a Prisma
interactive transaction, or nothing at all. See the MULTI-WRITE template in
[references/templates.md](./references/templates.md).

**On `@withTransaction`.** Some older projects hoist the whole body into a
`@withTransaction<IFoo>()` class decorator. Do not reach for it: it is not shipped
by any `@efesto-cloud` package (each project copy-pastes its own into
`decorator/withTransaction.ts`), it transacts the entire method including the
lookups and validation that have no business being inside a transaction, and being
attached to the class it makes the answer to the test above invisible at the point
where the writes happen. Leave it where it already is; use `IUnitOfWork` in new
code.

Some backends have no transactions at all — Cloudflare D1, for one. There
`IUnitOfWork` may not be bound: order the writes so the one that matters most lands
first, and say so in a comment.

### Audit trails are not a decorator

There is no `@audit` step here, and there is no audit package to install. A generic
audit decorator was tried, shipped as `@efesto-cloud/audit`, and retired in August
2026 after two years and zero uses across 604 use cases in five projects. What
teams actually build, when they need a trail, is the domain artifact described in
*Before You Start*: `PraticaStatusChange`-style entities appended by the use case,
or outbox events. Those carry the domain's own schema and can be queried by the
app; a generic execution trace cannot.

### Auth service API

All auth services share the same interface:
- `auth.flatRun(fn, input)` — calls `fn()` inside an auth check; `fn` returns `Result<S, F>` → returns `Result<S, NotLoggedError | F>`
- `auth.run(fn, input)` — same but `fn` returns a plain value (not a Result)
- `auth.get(input)` — returns `Maybe<Actor>` — use when you need the actor object itself (e.g. to stamp an owner field)

### Injecting application services

Not all use cases only need repos. Some also need application-level services (email, file storage, CSV export, job queues…). Inject them from `Symbols.Service.*` the same way as repos:

```ts
constructor(
  @inject(Symbols.Repo.FooRepo) readonly repo: IFooRepo,
  @inject(Symbols.Service.EmailService) readonly email: IEmailService,
  @inject(Symbols.DomainService.OperatorAuthService) readonly auth: IOperatorAuthService,
) {}
```

## Step 3 — Symbol

Add the new use case name to `di/Symbols.ts` in two places:

**1. The union type** for the domain:

```ts
type MyDomainUC =
  | "CreateMyEntity"
  | "GetMyEntity"
  | "MyNewUseCaseName"; // ← add here
```

**2. The runtime enum object** for the domain:

```ts
const MyDomainUCEnum = {
  CreateMyEntity: "CreateMyEntity",
  GetMyEntity: "GetMyEntity",
  MyNewUseCaseName: "MyNewUseCaseName", // ← add here
} as const;
```

The `Symbols.UseCase.myDomain` object is derived automatically by the `convert()` helper — no further changes needed in the `Symbols` const.

## Step 4 — Binding

Add one line to `di/container.ts`. Find the block for the domain and append:

```ts
container.bind<IMyUseCase>(Symbols.UseCase.myDomain.MyNewUseCaseName).to(MyNewUseCaseName).inRequestScope();
```

Add the import at the top of `container.ts` alongside the other imports for that domain:

```ts
import MyNewUseCaseName from "~/useCase/myDomain/impl/MyNewUseCaseName.js";
```

## Logic Placement Guide

See [references/logic-guide.md](./references/logic-guide.md) for a full decision table and examples.

Rule of thumb: if the operation can be expressed purely in terms of the entity's own fields, push it
to the entity. As soon as it needs to load or save something, it belongs in the use case.

## Checklist

Before finishing, verify:

- [ ] Interface file created and re-exported (type-only) from `useCase/{domain}/index.ts`
- [ ] Implementation file created with `@injectable()`
- [ ] Transaction question answered: two-or-more-writes-that-must-agree → `IUnitOfWork.runWithTransaction` around the writes only; otherwise no transaction
- [ ] If the change needs a history, the domain artifact (status-change entity or
      outbox event) is written by the use case — not delegated to a decorator
- [ ] Auth service injected and `flatRun` / `run` used to wrap the body
- [ ] All repo and service deps declared in constructor with `@inject(Symbols.…)`
- [ ] Symbol name added to both the union type and the enum object in `Symbols.ts`
- [ ] Binding added to `container.ts` with the matching import
- [ ] `server.ts` exports the domain `index.ts` (only if this is a brand-new domain)
- [ ] If a new repo method was needed: used the `/persistence` skill (`persistence`)
- [ ] If a new entity was needed: used the `/entity` skill (`entity`)

## Related Skills

- **`/entity`** (`entity`) — Create or update domain entities and DTOs
- **`/persistence`** (`persistence`) — Add repository interfaces, implementations, mappers, and MongoDB document types
