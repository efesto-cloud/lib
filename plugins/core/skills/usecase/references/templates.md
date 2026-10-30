# Use Case Templates

Ready-to-copy templates for the most common patterns. Replace `Foo` / `foo` with your entity and domain names.

---

## Interface — operator auth, mutating

```ts
import { IUseCase } from "@efesto-cloud/usecase";
import { Result } from "@efesto-cloud/result";
import IFoo from "~/dto/IFoo.js";
import NotFoundError from "~/errors/NotFoundError.js";
import NotLoggedError from "~/errors/NotLoggedError.js";
import { WithOperatorAuth } from "~/service/IOperatorAuthService.js";

type ICreateFoo = IUseCase<
  WithOperatorAuth<{
    name: string;
    description?: string;
  }>,
  Result<IFoo, NotLoggedError>
>;

export default ICreateFoo;
```

---

## Interface — business entity auth

```ts
import { IUseCase } from "@efesto-cloud/usecase";
import { Result } from "@efesto-cloud/result";
import IFoo from "~/dto/IFoo.js";
import NotFoundError from "~/errors/NotFoundError.js";
import NotLoggedError from "~/errors/NotLoggedError.js";
import { WithImpresaAuth } from "~/service/IImpresaAuthService.js";

type IGetSelfFoo = IUseCase<
  WithImpresaAuth,
  Result<IFoo, NotLoggedError | NotFoundError>
>;

export default IGetSelfFoo;
```

---

## Interface — dual auth (either actor can call)

```ts
import { IUseCase } from "@efesto-cloud/usecase";
import { Result } from "@efesto-cloud/result";
import IFoo from "~/dto/IFoo.js";
import NotFoundError from "~/errors/NotFoundError.js";
import { WithDualAuth } from "~/service/IDualAuthService.js";

type ISearchFoo = IUseCase<
  WithDualAuth<{
    name?: string;
    include_deleted?: boolean;
  }>,
  Result<IFoo[], NotFoundError>
>;

export default ISearchFoo;
```

---

## Interface — no auth (public operation)

```ts
import { IUseCase } from "@efesto-cloud/usecase";
import { Result } from "@efesto-cloud/result";
import IFoo from "~/dto/IFoo.js";
import NotFoundError from "~/errors/NotFoundError.js";

type IGetPublicFoo = IUseCase<
  { slug: string },
  Result<IFoo, NotFoundError>
>;

export default IGetPublicFoo;
```

---

## Implementation — CREATE (single write — no transaction)

```ts
import Result from "@efesto-cloud/result";
import { type IExecutionContext } from "@efesto-cloud/usecase";
import { inject, injectable } from "inversify";
import Symbols from "~/di/Symbols.js";
import Foo from "~/entity/Foo.js";
import type IFooRepo from "~/repo/IFooRepo.js";
import type IOperatorAuthService from "~/service/IOperatorAuthService.js";
import { WithOperatorAuth } from "~/service/IOperatorAuthService.js";
import ICreateFoo from "../ICreateFoo.js";

@injectable()
export default class CreateFoo implements ICreateFoo {
  readonly name = this.constructor.name;

  constructor(
    @inject(Symbols.Repo.FooRepo) readonly repo: IFooRepo,
    @inject(Symbols.DomainService.OperatorAuthService) readonly auth: IOperatorAuthService,
  ) {}

  async execute(input: WithOperatorAuth<{ name: string; description?: string }>, _context: IExecutionContext) {
    return this.auth.flatRun(async () => {
      const foo = Foo.create({ name: input.name, description: input.description });
      await this.repo.save(foo);
      return Result.ok(foo.toDTO());
    }, input);
  }
}
```

---

## Implementation — UPDATE (load → mutate → save, single write)

```ts
import Result from "@efesto-cloud/result";
import { type IExecutionContext } from "@efesto-cloud/usecase";
import { inject, injectable } from "inversify";
import Symbols from "~/di/Symbols.js";
import Foo from "~/entity/Foo.js";
import type IFooRepo from "~/repo/IFooRepo.js";
import type IOperatorAuthService from "~/service/IOperatorAuthService.js";
import { WithOperatorAuth } from "~/service/IOperatorAuthService.js";
import NotFoundError from "~/errors/NotFoundError.js";
import IUpdateFoo from "../IUpdateFoo.js";

@injectable()
export default class UpdateFoo implements IUpdateFoo {
  readonly name = this.constructor.name;

  constructor(
    @inject(Symbols.Repo.FooRepo) readonly repo: IFooRepo,
    @inject(Symbols.DomainService.OperatorAuthService) readonly auth: IOperatorAuthService,
  ) {}

  async execute(input: WithOperatorAuth<{ _id: string; data: Partial<{ name: string }> }>, _context: IExecutionContext) {
    return this.auth.flatRun(async () => {
      const maybe = await this.repo.get(input._id);
      if (!maybe.isSome()) return Result.err(new NotFoundError(Foo));

      maybe.data.update(input.data);
      await this.repo.save(maybe.data);
      return Result.ok(maybe.data.toDTO());
    }, input);
  }
}
```

---

## Implementation — DELETE (soft delete, single write)

```ts
import Result from "@efesto-cloud/result";
import { type IExecutionContext } from "@efesto-cloud/usecase";
import { inject, injectable } from "inversify";
import Symbols from "~/di/Symbols.js";
import Foo from "~/entity/Foo.js";
import type IFooRepo from "~/repo/IFooRepo.js";
import type IOperatorAuthService from "~/service/IOperatorAuthService.js";
import { WithOperatorAuth } from "~/service/IOperatorAuthService.js";
import NotFoundError from "~/errors/NotFoundError.js";
import IDeleteFoo from "../IDeleteFoo.js";

@injectable()
export default class DeleteFoo implements IDeleteFoo {
  readonly name = this.constructor.name;

  constructor(
    @inject(Symbols.Repo.FooRepo) readonly repo: IFooRepo,
    @inject(Symbols.DomainService.OperatorAuthService) readonly auth: IOperatorAuthService,
  ) {}

  async execute(input: WithOperatorAuth<{ _id: string }>, _context: IExecutionContext) {
    return this.auth.flatRun(async () => {
      const maybe = await this.repo.get(input._id);
      if (!maybe.isSome()) return Result.err(new NotFoundError(Foo));

      maybe.data.delete(); // entity method marks deleted_at
      await this.repo.save(maybe.data);
      return Result.ok();
    }, input);
  }
}
```

---

## Implementation — MULTI-WRITE (this is where a transaction belongs)

A transaction is warranted when the operation performs **two or more writes that
must land or fail together**. Around a single `repo.save()` it buys nothing: the
write is already atomic, and the wrapper only adds a connection held open and a
layer to read past.

Inject `IUnitOfWork` and wrap **only** the writes — validation and lookups stay
outside, so the transaction is open for as short a time as possible.

```ts
import Result from "@efesto-cloud/result";
import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import { type IExecutionContext } from "@efesto-cloud/usecase";
import { inject, injectable } from "inversify";
import Symbols from "~/di/Symbols.js";
import Foo from "~/entity/Foo.js";
import FooStatusChange from "~/entity/FooStatusChange.js";
import NotFoundError from "~/errors/NotFoundError.js";
import type IFooRepo from "~/repo/IFooRepo.js";
import type IFooStatusChangeRepo from "~/repo/IFooStatusChangeRepo.js";
import type IOperatorAuthService from "~/service/IOperatorAuthService.js";
import { WithOperatorAuth } from "~/service/IOperatorAuthService.js";
import ITransitionFoo from "../ITransitionFoo.js";

@injectable()
export default class TransitionFoo implements ITransitionFoo {
  readonly name = this.constructor.name;

  constructor(
    @inject(Symbols.DatabaseContext) readonly db: IUnitOfWork,
    @inject(Symbols.Repo.FooRepo) readonly repo: IFooRepo,
    @inject(Symbols.Repo.FooStatusChangeRepo) readonly history: IFooStatusChangeRepo,
    @inject(Symbols.DomainService.OperatorAuthService) readonly auth: IOperatorAuthService,
  ) {}

  async execute(input: WithOperatorAuth<{ _id: string; to: FooStatus }>, _context: IExecutionContext) {
    return this.auth.flatRun(async () => {
      // Load and validate OUTSIDE the transaction.
      const found = await this.repo.get(input._id);
      if (!found.isSome()) return Result.err(new NotFoundError(Foo));

      const from = found.data.status;
      const moved = found.data.applyTransition(input.to);
      if (moved.isFailure()) return Result.err(moved.error);

      // Two writes that must agree: the new state and the history row that
      // records it. Half of this pair landing is a corrupt audit trail.
      await this.db.runWithTransaction(async () => {
        await this.repo.save(found.data);
        await this.history.append(
          FooStatusChange.record({ foo_id: found.data._id, from, to: input.to }),
        );
      });

      return Result.ok(found.data.toDTO());
    }, input);
  }
}
```

Notes:

- `IUnitOfWork` comes from `@efesto-cloud/unit-of-work` and is a one-method port:
  `runWithTransaction<T>(fn: () => Promise<T>): Promise<T>`. The adapter binds the
  concrete implementation (Mongo session, Prisma interactive transaction…) — core
  never knows which.
- The DI symbol is `Symbols.DatabaseContext` here to match the rest of this file;
  projects that have split their symbols call it `InternalSymbols.DatabaseContext`.
- Some backends have no transactions at all — Cloudflare D1, for one. There
  `IUnitOfWork` may be absent entirely; order the writes so the one that matters
  most lands first, and say so in a comment.

---

## Implementation — GET (read-only, dual auth)

```ts
import Result from "@efesto-cloud/result";
import { type IExecutionContext } from "@efesto-cloud/usecase";
import { inject, injectable } from "inversify";
import Symbols from "~/di/Symbols.js";
import Foo from "~/entity/Foo.js";
import type IFooRepo from "~/repo/IFooRepo.js";
import type IDualAuthService from "~/service/IDualAuthService.js";
import { WithDualAuth } from "~/service/IDualAuthService.js";
import NotFoundError from "~/errors/NotFoundError.js";
import IGetFoo from "../IGetFoo.js";

@injectable()
export default class GetFoo implements IGetFoo {
  readonly name = this.constructor.name;

  constructor(
    @inject(Symbols.Repo.FooRepo) readonly repo: IFooRepo,
    @inject(Symbols.DomainService.DualAuthService) readonly auth: IDualAuthService,
  ) {}

  async execute(input: WithDualAuth<{ _id: string }>, _context: IExecutionContext) {
    return this.auth.flatRun(async () => {
      const maybe = await this.repo.get(input._id);
      if (!maybe.isSome()) return Result.err(new NotFoundError(Foo));
      return Result.ok(maybe.data.toDTO());
    }, input);
  }
}
```

---

## Implementation — SEARCH (read-only, operator auth)

```ts
import Result from "@efesto-cloud/result";
import { type IExecutionContext } from "@efesto-cloud/usecase";
import { inject, injectable } from "inversify";
import Symbols from "~/di/Symbols.js";
import type IFooRepo from "~/repo/IFooRepo.js";
import type IOperatorAuthService from "~/service/IOperatorAuthService.js";
import { WithOperatorAuth } from "~/service/IOperatorAuthService.js";
import ISearchFoo from "../ISearchFoo.js";

@injectable()
export default class SearchFoo implements ISearchFoo {
  readonly name = this.constructor.name;

  constructor(
    @inject(Symbols.Repo.FooRepo) readonly repo: IFooRepo,
    @inject(Symbols.DomainService.OperatorAuthService) readonly auth: IOperatorAuthService,
  ) {}

  async execute(input: WithOperatorAuth<{ name?: string; include_deleted?: boolean }>, _context: IExecutionContext) {
    return this.auth.flatRun(async () => {
      const items = await this.repo.search({ name: input.name, include_deleted: input.include_deleted });
      return Result.ok(items.map(i => i.toDTO()));
    }, input);
  }
}
```

---

## Symbols.ts additions

```ts
// 1. Union type — add the new name:
type FooUC =
  | "CreateFoo"
  | "GetFoo"
  | "UpdateFoo"
  | "DeleteFoo"
  | "SearchFoo"; // ← new

// 2. Enum object — mirror exactly:
const FooUCEnum = {
  CreateFoo: "CreateFoo",
  GetFoo: "GetFoo",
  UpdateFoo: "UpdateFoo",
  DeleteFoo: "DeleteFoo",
  SearchFoo: "SearchFoo", // ← new
} as const;
```

---

## container.ts additions

```ts
// Top of file — import next to other foo use case imports:
import SearchFoo from "~/useCase/foo/impl/SearchFoo.js";

// In the bindings block — next to other foo bindings:
container.bind<ISearchFoo>(Symbols.UseCase.foo.SearchFoo).to(SearchFoo).inRequestScope();
```
