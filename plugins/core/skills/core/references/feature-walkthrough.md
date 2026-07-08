# Feature walkthrough — `Foo` end-to-end

One synthetic feature traced through every file the 12-step recipe in
SKILL.md touches. The body uses `Foo`, `IFoo*`, `FooEntity`, etc.,
so it's portable. Each section ends with a "Seen in the wild" block
that points to a concrete file in `task-planning` that demonstrates
the pattern live.

The story: we're adding a `Foo` aggregate with three operations —
`CreateFoo`, `GetFoo`, `UpdateFooName` — backed by the project's
persistence adapter (`@*/persistence-adapter`). The concrete adapter is
whatever database the project chose (`@*/prisma-adapter`,
`@*/mongodb-adapter`, `@*/drizzle-adapter`, …); the walkthrough keeps the
adapter step DB-neutral and points to the database's dedicated skill for
driver code.

For full per-layer detail open the relevant per-layer reference; this
file is the orchestrating narrative.

---

## Step 1 — Value object

A `Foo` has a `name` that must be 1–80 characters, trimmed, no
control characters. That's a domain primitive: encapsulate it.

```ts
// core/src/value_object/FooName.ts
import Result from "@efesto-cloud/result";
import InvalidFooNameError from "~/errors/InvalidFooNameError.js";

const MIN = 1;
const MAX = 80;

export default class FooName {
    private readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    static create(raw: string): Result<FooName, InvalidFooNameError> {
        if (typeof raw !== "string") return Result.err(new InvalidFooNameError());
        const trimmed = raw.trim();
        if (trimmed.length < MIN || trimmed.length > MAX) {
            return Result.err(new InvalidFooNameError());
        }
        return Result.ok(new FooName(trimmed));
    }

    toRaw(): string { return this.value; }
    equals(other: FooName): boolean { return this.value === other.value; }
}
```

Add to `core/src/value_object/index.ts`:

```ts
export { default as FooName } from "./FooName.js";
```

> **Seen in the wild:**
> `packages/core/src/value_object/EmailAddress.ts` — same shape,
> regex-based validation instead of length.

Full details: `references/value-object.md`.

---

## Step 2 — Constrained string fields

A `Foo` has a `status: "draft" | "published"`. Use the
type/enum/dict trio:

```ts
// core/src/type/TFooStatus.ts
type TFooStatus = "draft" | "published";
export default TFooStatus;
```

```ts
// core/src/enum/FooStatusEnum.ts
import TFooStatus from "../type/TFooStatus.js";
const FooStatusEnum: Enum<TFooStatus> = {
    draft: "draft",
    published: "published",
};
export default FooStatusEnum;
```

```ts
// core/src/dict/FooStatusDesc.ts
import TFooStatus from "../type/TFooStatus.js";
import FooStatusEnum from "../enum/FooStatusEnum.js";
const FooStatusDesc: Desc<TFooStatus> = {
    [FooStatusEnum.draft]: "Bozza",
    [FooStatusEnum.published]: "Pubblicato",
};
export default FooStatusDesc;
```

Update the three barrels (`type/index.ts`, `enum/index.ts`,
`dict/index.ts`).

> **Seen in the wild:**
> `packages/core/src/type/MemberRole.ts` +
> `packages/core/src/enum/MemberRoleEnum.ts` +
> `packages/core/src/dict/MemberRoleDesc.ts`.

Full details: `references/type-enum-dict.md`.

---

## Step 3 — Entity

```ts
// core/src/entity/Foo.ts
import { randomUUID } from "node:crypto";
import Entity, { type IEntity } from "@efesto-cloud/entity";
import Result from "@efesto-cloud/result";
import type { DateTime } from "luxon";
import type FooDto from "~/dto/FooDto.js";
import type DomainError from "~/errors/DomainError.js";
import InvalidFooNameError from "~/errors/InvalidFooNameError.js";
import type IClock from "~/service/IClock.js";
import type TFooStatus from "~/type/TFooStatus.js";
import FooName from "~/value_object/FooName.js";

type FooProps = {
    name: FooName;
    status: TFooStatus;
    created_at: DateTime;
    updated_at: DateTime;
    deleted_at: DateTime<true> | null;
};

export default class Foo extends Entity<FooProps, string> implements IEntity<string> {
    constructor(props: FooProps, id?: string) {
        super(props, id ?? randomUUID());
    }

    get name(): FooName { return this.props.name; }
    get status(): TFooStatus { return this.props.status; }
    get created_at(): DateTime { return this.props.created_at; }
    get updated_at(): DateTime { return this.props.updated_at; }

    rename(name: string, clock: IClock): Result<void, DomainError> {
        const next = FooName.create(name);
        if (next.isFailure()) return Result.err(next.error);
        this.props.name = next.data;
        this._touch(clock);
        return Result.ok(undefined);
    }

    publish(clock: IClock): void {
        this.props.status = "published";
        this._touch(clock);
    }

    private _touch(clock: IClock): void {
        this.props.updated_at = clock.now();
    }

    toDTO(): FooDto {
        return {
            _id: this._id,
            name: this.props.name.toRaw(),
            status: this.props.status,
            created_at: this.props.created_at.toISO() ?? "",
            updated_at: this.props.updated_at.toISO() ?? "",
            deleted_at: this.deleted_at?.toISO() ?? null,
        };
    }

    static create(
        props: { name: string; status?: TFooStatus },
        clock: IClock,
        id?: string,
    ): Result<Foo, DomainError> {
        const name = FooName.create(props.name);
        if (name.isFailure()) return Result.err(name.error);

        const now = clock.now();
        return Result.ok(new Foo({
            name: name.data,
            status: props.status ?? "draft",
            created_at: now,
            updated_at: now,
            deleted_at: null,
        }, id));
    }
}
```

Export from `core/src/entity/index.ts`:

```ts
export { default as Foo } from "./Foo.js";
```

> **Seen in the wild:**
> `packages/core/src/entity/Member.ts` — same structure, more fields,
> uses `EmailAddress` and `PasswordHash` value objects.

Full details: `references/entity.md`.

---

## Step 4 — DTO

```ts
// core/src/dto/FooDto.ts
import type TFooStatus from "~/type/TFooStatus.js";

interface FooDto {
    _id: string;
    name: string;                  // FooName serialised
    status: TFooStatus;
    created_at: string;            // ISO string
    updated_at: string;
    deleted_at: string | null;
}

export default FooDto;
```

Export type-only:

```ts
// core/src/dto/index.ts
export type { default as FooDto } from "./FooDto.js";
```

> **Seen in the wild:**
> `packages/core/src/dto/MemberDto.ts`.

Full details: `references/dto.md`.

---

## Step 5 — Errors

```ts
// core/src/errors/InvalidFooNameError.ts
import DomainError from "./DomainError.js";
export default class InvalidFooNameError extends DomainError {}
```

```ts
// core/src/errors/FooNotFoundError.ts
import DomainError from "./DomainError.js";
export default class FooNotFoundError extends DomainError {}
```

Export from `core/src/errors/index.ts`:

```ts
export { default as DomainError } from "./DomainError.js";
export { default as InvalidFooNameError } from "./InvalidFooNameError.js";
export { default as FooNotFoundError } from "./FooNotFoundError.js";
```

> **Seen in the wild:**
> `packages/core/src/errors/DomainError.ts`,
> `packages/core/src/errors/MemberNotFoundError.ts`,
> `packages/core/src/errors/InvalidEmailFormatError.ts`.

Full details: `references/errors.md`.

---

## Step 6 — Repository port

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

Export type-only:

```ts
// core/src/repo/index.ts
export type { default as IFooRepository } from "./IFooRepository.js";
```

> **Seen in the wild:**
> `packages/core/src/repo/IMemberRepository.ts` — `findById` with
> `includeDeleted` option; `list({ q, limit, offset })` paged result.

Full details: `references/repository-port.md`.

---

## Step 7 — Service ports needed

`CreateFooUseCase` needs `IClock` to stamp `created_at`. It already
exists in `core/src/service/IClock.ts` and is bound by
`installServices()` to `LuxonClock`. No new files.

If the use case needed a *new* service (e.g. `IFooIdGenerator` because
UUID isn't acceptable):

1. Add interface in `core/src/service/IFooIdGenerator.ts`.
2. Add symbol in `core/src/di/InternalSymbols.ts`:
   ```ts
   Service: {
       // ...
       FooIdGenerator: Symbol.for("Service.FooIdGenerator"),
   }
   ```
3. Bind in `ServicesModule.ts` (if pure) or `installServices()` (if
   impure) or the adapter's `install.ts` (if I/O bound).

Full details: `references/service-port.md`.

---

## Step 8 — Use case interface

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

Type-only re-export:

```ts
// core/src/useCase/foos/index.ts
export type { default as ICreateFooUseCase } from "./ICreateFooUseCase.js";
export type { default as IGetFooUseCase } from "./IGetFooUseCase.js";
export type { default as IUpdateFooNameUseCase } from "./IUpdateFooNameUseCase.js";
```

> **Seen in the wild:**
> `packages/core/src/useCase/members/ICreateMemberUseCase.ts`.

Full details: `references/usecase.md`.

---

## Step 9 — Use case impl + binding + registry augmentation

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

```ts
// core/src/useCase/foos/FoosModule.ts
import { ContainerModule } from "inversify";
import UseCaseSymbols from "~/di/UseCaseSymbols.js";
import type ICreateFooUseCase from "./ICreateFooUseCase.js";
import type IGetFooUseCase from "./IGetFooUseCase.js";
import type IUpdateFooNameUseCase from "./IUpdateFooNameUseCase.js";
import CreateFooUseCase from "./impl/CreateFooUseCase.js";
import GetFooUseCase from "./impl/GetFooUseCase.js";
import UpdateFooNameUseCase from "./impl/UpdateFooNameUseCase.js";

declare module "~/di/UseCaseRegistry.js" {
    interface UseCaseRegistry {
        "foos.CreateFoo": ICreateFooUseCase;
        "foos.GetFoo": IGetFooUseCase;
        "foos.UpdateFooName": IUpdateFooNameUseCase;
    }
}

const FoosModule = new ContainerModule((bind) => {
    bind(UseCaseSymbols.foos.CreateFoo).to(CreateFooUseCase).inRequestScope();
    bind(UseCaseSymbols.foos.GetFoo).to(GetFooUseCase).inRequestScope();
    bind(UseCaseSymbols.foos.UpdateFooName).to(UpdateFooNameUseCase).inRequestScope();
});

export default FoosModule;
```

> **Seen in the wild:**
> `packages/core/src/useCase/members/MembersModule.ts`,
> `packages/core/src/useCase/members/impl/CreateMemberUseCase.ts`.

Full details: `references/usecase.md` and `references/di-layer.md`.

---

## Step 10 — DI symbol entries

```ts
// core/src/di/UseCaseSymbols.ts
const UseCaseSymbols = {
    // ...
    foos: {
        CreateFoo: Symbol.for("UseCase.foos.CreateFoo"),
        GetFoo: Symbol.for("UseCase.foos.GetFoo"),
        UpdateFooName: Symbol.for("UseCase.foos.UpdateFooName"),
    },
} as const;
export default UseCaseSymbols;
```

```ts
// core/src/di/InternalSymbols.ts
const InternalSymbols = {
    UnitOfWork: Symbol.for("UnitOfWork"), // typed as IUnitOfWork; bound by the adapter
    Repo: {
        // ...
        Foo: Symbol.for("Repo.Foo"),
    },
    DomainService: { /* ... */ },
    Service: { /* ... */ },
} as const;
export default InternalSymbols;
```

Register the new module in `core/src/di/container.ts`:

```ts
import FoosModule from "../useCase/foos/FoosModule.js";
// ...
container.load(
    CalendarModule,
    CustomersModule,
    FoosModule,           // ← here
    MembersModule,
    // ...
);
```

If `core/src/server.ts` has side-effect imports for each module file
(it does in `task-planning`), add one for the new module:

```ts
import "./useCase/foos/FoosModule.js";
```

> **Seen in the wild:**
> `packages/core/src/di/UseCaseSymbols.ts`,
> `packages/core/src/di/InternalSymbols.ts`,
> `packages/core/src/di/container.ts`,
> `packages/core/src/server.ts`.

Full details: `references/di-layer.md`.

---

## Step 11 — Adapter: repo impl + mapper + installer edit

This step lives in the **persistence adapter package**
(`@*/persistence-adapter` — concretely `@*/prisma-adapter`,
`@*/mongodb-adapter`, `@*/drizzle-adapter`, …), never in core. The shape
below is **database-agnostic**: the mapper implements
`IEntityMapper<Foo, FooRow>`, the repo injects `IUnitOfWork` and delegates
row ↔ entity translation to the mapper, and the driver calls are left as
DB-neutral pseudocode. For the concrete driver code (Prisma `findFirst` /
`upsert`, MongoDB `Collection` queries, …) defer to the database's
dedicated skill — `prisma-persistence` / `mongodb-persistence`.

**The mapper** (`@*/persistence-adapter/src/mapper/FooMapper.ts`) — the
only place that knows the stored record's shape. `FooRow` is whatever the
driver returns (a Prisma generated payload, a hand-written MongoDB
`FooDocument`, a Drizzle inferred row, …):

```ts
// @*/persistence-adapter/src/mapper/FooMapper.ts
import type { IEntityMapper } from "@efesto-cloud/entity";
import { Foo, FooName, type TFooStatus } from "@my-app/core";
import { DateTime } from "luxon";

// RAW = the database's native record type for this entity.
type FooRow = { /* …driver-specific shape… */ };

const FooMapper: IEntityMapper<Foo, FooRow> = {
    from: (row: FooRow): Foo => {
        const name = FooName.create(row.name);
        if (name.isFailure()) {
            // Corrupt DB row: throw with a row-identifying message.
            throw new Error(`Invalid name in database for Foo ${row.id}: ${row.name}`);
        }
        return new Foo(
            {
                name: name.data,
                status: row.status as TFooStatus,
                created_at: DateTime.fromJSDate(row.created_at),
                updated_at: DateTime.fromJSDate(row.updated_at),
                deleted_at: row.deleted_at
                    ? (DateTime.fromJSDate(row.deleted_at) as DateTime<true>)
                    : null,
            },
            row.id,
        );
    },

    to: (foo: Foo): FooRow => ({
        id: foo._id,
        name: foo.name.toRaw(),
        status: foo.status,
        created_at: foo.created_at.toJSDate(),
        updated_at: foo.updated_at.toJSDate(),
        deleted_at: foo.deleted_at?.toJSDate() ?? null,
    }),
};

export default FooMapper;
```

**The repo impl**
(`@*/persistence-adapter/src/repository/FooRepoImpl.ts`) — `@injectable()`,
implements the core port, injects the unit-of-work (transaction) port,
and delegates to the mapper. Only the driver calls inside each method are
database-specific:

```ts
// @*/persistence-adapter/src/repository/FooRepoImpl.ts
import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import {
    type Foo,
    type IFooRepository,
    InternalSymbols,
    type TFooStatus,
} from "@my-app/core";
import { inject, injectable } from "inversify";
import FooMapper from "../mapper/FooMapper.js";

@injectable()
export default class FooRepoImpl implements IFooRepository {
    constructor(
        // The transaction coordinator (IUnitOfWork-backed DB handle).
        @inject(InternalSymbols.UnitOfWork)
        private readonly uow: IUnitOfWork,
    ) {}

    async findById(
        id: string,
        options?: { includeDeleted?: boolean },
    ): Promise<Foo | null> {
        // driver-specific read by id, filtering deleted_at: null unless includeDeleted
        const row = await /* …query by id… */;
        return row ? FooMapper.from(row) : null;
    }

    async list(filter: {
        status?: TFooStatus;
        q?: string;
        includeDeleted: boolean;
        limit: number;
        offset: number;
    }): Promise<{ items: Foo[]; total: number }> {
        // driver-specific paged read + count (run in parallel), applying:
        //   - status filter when filter.status is set
        //   - deleted_at: null unless filter.includeDeleted
        //   - case-insensitive name match when filter.q is set
        //   - skip filter.offset / take filter.limit
        const { rows, total } = await /* … */;
        return { items: rows.map(FooMapper.from), total };
    }

    async save(foo: Foo): Promise<void> {
        const data = FooMapper.to(foo);
        await /* driver-specific upsert by data.id */;
    }
}
```

`save` is an upsert (one method for insert + update); every read filters
`deleted_at IS NULL` unless `{ includeDeleted: true }`; `list` returns
`{ items, total }`. These invariants hold for every adapter — see
`references/persistence-adapter.md`.

**Transactions.** A multi-write use case stays DB-agnostic by going
through `IUnitOfWork.runWithTransaction` (from
`@efesto-cloud/unit-of-work`); the adapter binds `InternalSymbols.UnitOfWork`
to the database's implementation — `@efesto-cloud/prisma-unit-of-work` or
`@efesto-cloud/mongodb-unit-of-work`.

**The installer** — edit `@*/persistence-adapter/src/install.ts` to bind
the new repo port to its impl:

```ts
// @*/persistence-adapter/src/install.ts
import {
    // ...
    type IFooRepository,
    InternalSymbols,
} from "@my-app/core";
import FooRepoImpl from "./repository/FooRepoImpl.js";
// ...

return new ContainerModule((bind) => {
    // ... existing bindings (DB client, unit-of-work, other repos)
    bind<IFooRepository>(InternalSymbols.Repo.Foo)
        .to(FooRepoImpl)
        .inRequestScope();
});
```

If a `@*/stub` adapter exists, mirror the binding there with the
in-memory impl, so use cases run unchanged under tests/mocks.

> **Seen in the wild:**
> the adapter package's
> `src/repository/MemberRepoImpl.ts`,
> `src/mapper/MemberMapper.ts`,
> `src/install.ts`.

Full details: `references/persistence-adapter.md` (+ the database's
dedicated skill: `prisma-persistence` / `mongodb-persistence` for
concrete driver code).

---

## Step 12 — Route loader / action wiring

```tsx
// webapp/app/routes/foos/_index.tsx
import type { Route } from "./+types/_index.js";

export async function loader({ request, context }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const useCase = context.resolveUseCase("foos.GetFoo");
    const result = await useCase.execute({
        foo_id: url.searchParams.get("id") ?? "",
    });
    if (result.isFailure()) {
        throw new Response("Not Found", { status: 404 });
    }
    return { foo: result.data };
}

export async function action({ request, context }: Route.ActionArgs) {
    const formData = await request.formData();
    const useCase = context.resolveUseCase("foos.CreateFoo");
    const result = await useCase.execute({
        name: formData.get("name") as string,
        status: (formData.get("status") as TFooStatus) ?? undefined,
    });
    if (result.isFailure()) {
        return { ok: false as const, error: result.error.name };
    }
    return { ok: true as const, foo: result.data };
}
```

The string `"foos.CreateFoo"` autocompletes — it's typed against
`keyof UseCaseRegistry`, and `UseCaseRegistry` got `foos.CreateFoo`
via the `declare module` block in `FoosModule.ts`.

> **Seen in the wild:**
> Members route loaders/actions under
> `packages/webapp/app/routes/members/...tsx`.

Full details: `references/composition-root.md`.

---

## Done

A working trace from value object to HTTP response. Every layer has a
dedicated reference file in this skill for the deeper rules and edge
cases.
