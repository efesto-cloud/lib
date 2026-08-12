# Use case

Use cases are the application layer's entry points. They orchestrate
the domain — load entities, mutate via entity methods, save back —
and expose a single `execute(input)` method that returns
`Result<T, DomainError>`.

## Files for a new use case

```
core/src/useCase/<domain>/I<Verb><Entity>UseCase.ts        — interface
core/src/useCase/<domain>/impl/<Verb><Entity>UseCase.ts    — impl
core/src/useCase/<domain>/index.ts                         — type-only re-export
core/src/useCase/<domain>/<Domain>Module.ts                — DI binding + registry augmentation
core/src/di/UseCaseSymbols.ts                              — new symbol entry
```

The `<Domain>Module.ts` covers steps 9–10 of the SKILL.md recipe in
one file. See `references/di-layer.md` for the module pattern.

## The interface

```ts
// core/src/useCase/foos/ICreateFooUseCase.ts
import type Result from "@efesto-cloud/result";
import type IUseCase from "@efesto-cloud/usecase";
import type FooDto from "~/dto/FooDto.js";
import type DomainError from "~/errors/DomainError.js";
import type TFooStatus from "~/type/TFooStatus.js";

export interface CreateFooInputDto {
    name: string;
    status?: TFooStatus;
}

interface ICreateFooUseCase
    extends IUseCase<CreateFooInputDto, Result<FooDto, DomainError>> {}

export default ICreateFooUseCase;
```

Conventions:

- **`IUseCase<TInput, TResponse>`** from `@efesto-cloud/usecase`
  — a tiny interface with one `execute(input): Promise<TResponse>`
  method.
- **Input is a single DTO.** If the use case has many input fields,
  bundle them into a `Create<Verb><Entity>InputDto` interface
  exported from the same file. Don't pass loose arguments.
- **Response is `Result<DTO, DomainError>` wrapped in Promise.** The
  caller can branch on `.isSuccess()` / `.isFailure()`.
- **Import DTOs, not entities.** The interface should be consumable
  by the client bundle without dragging entity classes into scope.

For idempotent operations that don't need to return anything:

```ts
interface IDeleteFooUseCase
    extends IUseCase<DeleteFooInputDto, Result<void, DomainError>> {}
```

For a `Result<void, …>`, return success with a bare `Result.ok()` —
`@efesto-cloud/result`'s `ok()` takes no argument and yields
`Result<void>`.

Re-export the interface type-only from the domain barrel:

```ts
// core/src/useCase/foos/index.ts
export type { default as ICreateFooUseCase } from "./ICreateFooUseCase.js";
```

## Authentication: actor on the input

If the use case needs to know who initiated it, include the actor in
the input:

```ts
export interface UpdateFooInputDto {
    foo_id: string;
    name?: string;
    actor: MemberDto;       // resolved by the webapp before calling execute()
}
```

For public operations (login, password reset request, etc.), use
`actor: MemberDto | null`. The use case's body opens with:

```ts
if (input.actor === null) {
    throw new Error("Actor required");  // programming bug; loader didn't authenticate
}
```

The reason for `throw`: this isn't a user-facing failure (the
loader should have caught absent actors with a 401 before reaching
the use case). It's a wiring bug. Surfacing it loudly is correct.

Don't ask the use case to call `IMemberAuthenticator` itself. The
authenticator's job is at the adapter boundary; the use case trusts
the actor it was given.

## The implementation

```ts
// core/src/useCase/foos/impl/CreateFooUseCase.ts
import Result from "@efesto-cloud/result";
import { inject, injectable } from "inversify";
import InternalSymbols from "~/di/InternalSymbols.js";
import type FooDto from "~/dto/FooDto.js";
import Foo from "~/entity/Foo.js";
import type DomainError from "~/errors/DomainError.js";
import type IFooRepository from "~/repo/IFooRepository.js";
import type IClock from "~/service/IClock.js";
import type ICreateFooUseCase from "~/useCase/foos/ICreateFooUseCase.js";
import type { CreateFooInputDto } from "~/useCase/foos/ICreateFooUseCase.js";

@injectable()
export default class CreateFooUseCase implements ICreateFooUseCase {
    readonly name = this.constructor.name;

    constructor(
        @inject(InternalSymbols.Repo.Foo)
        private readonly fooRepo: IFooRepository,
        @inject(InternalSymbols.Service.Clock)
        private readonly clock: IClock,
    ) {}

    async execute(
        input: CreateFooInputDto,
    ): Promise<Result<FooDto, DomainError>> {
        const created = Foo.create(
            { name: input.name, status: input.status },
            this.clock,
        );
        if (created.isFailure()) return Result.err(created.error);

        await this.fooRepo.save(created.data);
        return Result.ok(created.data.toDTO());
    }
}
```

Anatomy:

- **`@injectable()`** — required for Inversify to bind the class.
- **`readonly name = this.constructor.name`** — useful for logging /
  audit. The constructor name (`"CreateFooUseCase"`) is a stable
  identifier.
- **Constructor injection only.** Every dep is `@inject(Symbol)
  private readonly`.
- **Single `async execute(input)` method.** No additional public
  methods.

The body always follows the same shape for mutating operations:

1. **Validate / construct** new state (`Foo.create(...)`).
2. **Branch on failure** with `if (result.isFailure()) return Result.err(...)`.
3. **Side effect** (`repo.save(...)`).
4. **Return success** with the serialised DTO.

For read use cases, the shape collapses to load + serialise:

```ts
async execute(input: GetFooInputDto): Promise<Result<FooDto, DomainError>> {
    const target = await this.fooRepo.findById(input.foo_id);
    if (!target) return Result.err(new FooNotFoundError());
    return Result.ok(target.toDTO());
}
```

For load-mutate-save:

```ts
async execute(input: UpdateFooInputDto): Promise<Result<FooDto, DomainError>> {
    const target = await this.fooRepo.findById(input.foo_id);
    if (!target) return Result.err(new FooNotFoundError());

    if (input.name !== undefined) {
        const renamed = target.rename(input.name, this.clock);
        if (renamed.isFailure()) return Result.err(renamed.error);
    }

    await this.fooRepo.save(target);
    return Result.ok(target.toDTO());
}
```

## Soft-delete use case

The recipe: load (including soft-deleted), check idempotence, mutate
via `delete()`, save.

```ts
async execute(input: DeleteFooInputDto): Promise<Result<void, DomainError>> {
    const target = await this.fooRepo.findById(input.foo_id);
    if (!target) return Result.err(new FooNotFoundError());
    if (target.isDeleted()) return Result.ok();              // idempotent

    target.delete();
    await this.fooRepo.save(target);
    return Result.ok();
}
```

The mirroring restore use case opens with
`findById(id, { includeDeleted: true })` and calls `target.restore()`.

## Use cases never call other use cases

Sharing behaviour goes through three channels:

- **Entity methods** for invariant-protected mutations
  (`foo.publish(clock)`).
- **Domain services** for cross-entity rules
  (`memberCodePolicy.generate(...)`).
- **`util/` helpers** for pure functions
  (`isStrongPassword(plaintext)`).

If you find yourself wanting to inject one use case into another, the
shared behaviour belongs on the entity or in a domain service. Use
cases composing peers makes the audit chain opaque and double-wraps
transactions when one is in play.

## Transaction handling

When the use case needs multi-table writes inside a transaction, wrap
the persistence-bound work in `runWithTransaction`. The use case stays
database-agnostic: it depends only on the `IUnitOfWork` port from
`@efesto-cloud/unit-of-work`, never on a concrete database client.

```ts
import type IUnitOfWork from "@efesto-cloud/unit-of-work";

@injectable()
export default class CreateFooUseCase implements ICreateFooUseCase {
    readonly name = this.constructor.name;

    constructor(
        @inject(InternalSymbols.Repo.Foo)
        private readonly fooRepo: IFooRepository,
        @inject(InternalSymbols.Repo.Bar)
        private readonly barRepo: IBarRepository,
        @inject(InternalSymbols.UnitOfWork)
        private readonly uow: IUnitOfWork,
    ) {}

    async execute(input): Promise<Result<FooDto, DomainError>> {
        // ... pre-validation ...

        const outcome = await this.uow.runWithTransaction(async () => {
            await this.fooRepo.save(foo);
            await this.barRepo.saveMany(foo.bars);
            return foo;
        });

        return Result.ok(outcome.toDTO());
    }
}
```

`IUnitOfWork` exposes a single
`runWithTransaction<T>(fn: () => Promise<T>): Promise<T>` method. The
adapter binds `InternalSymbols.UnitOfWork` to a database-specific
implementation (`@efesto-cloud/prisma-unit-of-work`,
`@efesto-cloud/mongodb-unit-of-work`, …) that makes the ambient
transaction handle available to the repo impls inside the callback —
so the repos don't take a `session`/`tx` parameter and the use case
doesn't know which database is underneath. See
`references/persistence-adapter.md`.

For projects that have moved to attribute-style decorators
(`@withTransaction`, `@audit`), the use case body wraps with a
single decorator call instead of the explicit
`runWithTransaction`. The decorators exist in
`@efesto-cloud/usecase` but are not enabled in every project; this
section describes the explicit form, which works without decorators.

## Validating input

The route loader/action is the first line of input validation
(usually via Zod). The use case then trusts that the input matches
the declared TypeScript type — it still runs domain validation
through the entity, but it doesn't re-verify field shapes.

```ts
async execute(input: CreateFooInputDto): Promise<Result<FooDto, DomainError>> {
    // input.name is a string here, guaranteed by TypeScript +
    // upstream parsing. Domain validation (length, format) happens
    // inside Foo.create.
    const created = Foo.create({ name: input.name }, this.clock);
    // ...
}
```

## Injecting application services

Beyond repos and `IClock`, common service deps include:

- `IPasswordHasher` (`InternalSymbols.Service.PasswordHasher`)
- `IExcelCodec` (`InternalSymbols.Service.ExcelCodec`)
- `IMemberAuthenticator` (`InternalSymbols.Service.MemberAuthenticator`)
- `ICalendarFeedService` (`InternalSymbols.Service.CalendarFeed`)

All injected with the same `@inject(...)` pattern:

```ts
constructor(
    @inject(InternalSymbols.Repo.Member)
    private readonly memberRepo: IMemberRepository,
    @inject(InternalSymbols.Service.PasswordHasher)
    private readonly passwordHasher: IPasswordHasher,
    @inject(InternalSymbols.Service.Clock)
    private readonly clock: IClock,
) {}
```

See `references/service-port.md` for the design rules.

## Logic placement — entity vs use case

Rule of thumb: **if the operation can be expressed purely in terms of
the entity's own fields, push it down to the entity. As soon as it
needs to load or save something, it belongs in the use case.**

| Operation | Layer |
|-----------|-------|
| Rename + revalidate the name | Entity |
| Publish (status transition with date stamping) | Entity |
| Calculate a derived field from props | Entity |
| Look up another entity by ID and tie them together | Use case |
| Persist changes | Use case |
| Send an email after saving | Use case |
| Validate uniqueness against the DB | Use case |
| Decide which of N entities is "the latest" | Use case |

Entity rules don't depend on the DB; use-case logic does. That's the
cleavage.

## Binding the use case

In the per-domain module file:

```ts
// core/src/useCase/foos/FoosModule.ts
import { ContainerModule } from "inversify";
import UseCaseSymbols from "~/di/UseCaseSymbols.js";
import type ICreateFooUseCase from "./ICreateFooUseCase.js";
import CreateFooUseCase from "./impl/CreateFooUseCase.js";

declare module "~/di/UseCaseRegistry.js" {
    interface UseCaseRegistry {
        "foos.CreateFoo": ICreateFooUseCase;
    }
}

const FoosModule = new ContainerModule((bind) => {
    bind(UseCaseSymbols.foos.CreateFoo)
        .to(CreateFooUseCase)
        .inRequestScope();
});

export default FoosModule;
```

The `declare module` augmentation gives the resolver its type. See
`references/di-layer.md`.

## Cross-layer summary

- **Reads from** repo ports (entities, paged lists).
- **Calls** entity factories / mutators (return `Result`).
- **Writes via** repo `save(entity)`.
- **Returns** `Result<DTO, DomainError>` to the route layer.
- **Never** imports adapter packages; never imports React Router or
  any HTTP code.
- **Never** calls other use cases.

## Checklist — new use case

- [ ] Interface file with `I<Verb><Entity>UseCase`, input DTO inline.
- [ ] Type-only re-export from `useCase/<domain>/index.ts`.
- [ ] Implementation file `<Verb><Entity>UseCase.ts` in `impl/`.
- [ ] `@injectable()` + `@inject(Symbol)` constructor.
- [ ] `readonly name = this.constructor.name`.
- [ ] Body follows load → validate → mutate → save → Result shape.
- [ ] Returns `Result<DTO, DomainError>`.
- [ ] Symbol added to `UseCaseSymbols.ts` under the domain.
- [ ] `<Domain>Module.ts` binding + registry augmentation updated.
- [ ] Module registered in `di/container.ts` (only when adding a new
      domain).
- [ ] If a repo or service was added, follow
      `references/repository-port.md` / `references/service-port.md`.
- [ ] `pnpm -F @*/core typecheck` passes.

## "Seen in the wild"

- `packages/core/src/useCase/members/ICreateMemberUseCase.ts`,
  `packages/core/src/useCase/members/impl/CreateMemberUseCase.ts` —
  classic create-with-uniqueness-check.
- `packages/core/src/useCase/members/impl/UpdateMemberProfileUseCase.ts`
  — load + mutate + save with embedded uniqueness check.
- `packages/core/src/useCase/members/impl/DeleteMemberUseCase.ts` —
  soft-delete with idempotent guard and last-admin protection.
- `packages/core/src/useCase/members/impl/RestoreMemberUseCase.ts` —
  the mirror restore use case.
- `packages/core/src/useCase/members/impl/GetMemberUseCase.ts` —
  minimal read.
- `packages/core/src/useCase/members/impl/ListMembersUseCase.ts` —
  paged list with filters.
