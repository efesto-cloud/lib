# The DI layer

The deepest of the references. DI in this codebase has more moving
parts than any single layer — symbols, modules, registry augmentation,
two-stage composition — and getting it wrong produces silent runtime
failures. This file is the canonical home for everything Inversify-
related in the core package.

The mental model in one paragraph: there are **two symbol files** in
`di/` — `InternalSymbols.ts` for infrastructure (repos, services,
the unit-of-work / transaction token), `UseCaseSymbols.ts` for use
cases. There is **one container**, defined in `di/container.ts`. Core
loads its own per-domain `<Domain>Module.ts` files into the container
at `initContainer()` time. The webapp's composition root later loads
one more `ContainerModule` for the chosen persistence adapter
(generically `installPersistence({...})`, or `installStub()`) plus one
more for the non-pure services (`installServices()`). The static
typing for
`resolveUseCase("members.GetMember")` comes from a `declare module`
augmentation on an otherwise-empty `UseCaseRegistry` interface, with
each `<Domain>Module.ts` contributing its own slice.

## Why two symbol files

`InternalSymbols.ts` and `UseCaseSymbols.ts` are split by **who binds
them** and **who consumes them**.

```ts
// di/InternalSymbols.ts
const InternalSymbols = {
    // The transaction / unit-of-work token, typed `IUnitOfWork`
    // (from `@efesto-cloud/unit-of-work`). Some projects name the
    // symbol `DatabaseContext` — the name is cosmetic; what matters is
    // that the adapter binds it to a DB-specific `IUnitOfWork` impl.
    UnitOfWork: Symbol.for("UnitOfWork"),

    Repo: {
        Customer: Symbol.for("Repo.Customer"),
        Member: Symbol.for("Repo.Member"),
        Pratica: Symbol.for("Repo.Pratica"),
        TimesheetEntry: Symbol.for("Repo.TimesheetEntry"),
    },

    DomainService: {
        // populated when domain services are added
    },

    Service: {
        AuditContext: Symbol.for("AuditContext"),
        CalendarFeed: Symbol.for("Service.CalendarFeed"),
        Clock: Symbol.for("Service.Clock"),
        ExcelCodec: Symbol.for("Service.ExcelCodec"),
        MemberAuthenticator: Symbol.for("Service.MemberAuthenticator"),
        PasswordHasher: Symbol.for("Service.PasswordHasher"),
    },
} as const;
export default InternalSymbols;
```

- **Bound by:** the persistence adapter (`@*/persistence-adapter` —
  concretely `@*/prisma-adapter` / `@*/mongodb-adapter` / …) and
  `@*/stub` for repos and the unit-of-work token; the core itself for
  pure services (`LuxonClock`, `ExcelJsCodec`); the webapp's
  `installServices()` call for impure services (`ScryptPasswordHasher`
  needs Node's `crypto`).
- **Consumed by:** use-case implementations and other services. The
  webapp never reads from `InternalSymbols.Repo.*` directly — those
  are infrastructure plumbing.

```ts
// di/UseCaseSymbols.ts
const UseCaseSymbols = {
    members: {
        CreateMember: Symbol.for("UseCase.members.CreateMember"),
        GetMember: Symbol.for("UseCase.members.GetMember"),
        // ...
    },
    pratiche: {
        CreateProspect: Symbol.for("UseCase.pratiche.CreateProspect"),
        // ...
    },
} as const;
export default UseCaseSymbols;
```

- **Bound by:** the per-domain `<Domain>Module.ts` inside
  `useCase/<domain>/`.
- **Consumed by:** the webapp's route loaders/actions via
  `context.resolveUseCase("members.GetMember")`.

Splitting them keeps the public surface (use cases) separate from the
infra surface (repos, services). The webapp `imports
UseCaseSymbols`-style content only **transitively** via the typed
resolver — direct imports of `InternalSymbols.Repo.X` from a loader
would be a code smell.

## Symbol naming convention

Always `Symbol.for(...)` (the global registry), never `Symbol(...)`.
Why: `Symbol.for("Repo.Member")` returns the same symbol value across
packages. The persistence adapter (`@*/persistence-adapter`) calls
`Symbol.for("Repo.Member")` (transitively, via importing the
`InternalSymbols` object) and gets the identical key the use case in
`@*/core` is injecting. With unique symbols, the two would be
different and bindings wouldn't resolve.

The string keys follow a hierarchical convention:

| Symbol | String key |
|--------|------------|
| `InternalSymbols.UnitOfWork` (a.k.a. `DatabaseContext`) | `"UnitOfWork"` |
| `InternalSymbols.Repo.<Entity>` | `"Repo.<Entity>"` |
| `InternalSymbols.Service.<Name>` | `"Service.<Name>"` |
| `InternalSymbols.DomainService.<Name>` | `"DomainService.<Name>"` |
| `UseCaseSymbols.<domain>.<UseCase>` | `"UseCase.<domain>.<UseCase>"` |

The use-case key (`"UseCase.<domain>.<UseCase>"`) matters extra: the
resolver in `resolveUseCase.ts` rebuilds it from a literal type:

```ts
return <K extends keyof UseCaseRegistry>(name: K): UseCaseRegistry[K] =>
    container.get<UseCaseRegistry[K]>(Symbol.for(`UseCase.${name}`));
```

If you change the string convention for use cases, you also have to
change the template literal in `resolveUseCase`. They are coupled.

## The per-domain `<Domain>Module.ts` pattern

Each domain under `useCase/` has a `<Domain>Module.ts` file at its
root. The file does three things:

1. **Imports** all interfaces and implementations for the domain.
2. **Augments** `UseCaseRegistry` with the
   `"<domain>.<UseCaseName>": I<UseCaseName>UseCase` mapping.
3. **Exports** a `ContainerModule` that binds every use case to its
   impl with `.inRequestScope()`.

Example:

```ts
// useCase/foos/FoosModule.ts
import { ContainerModule } from "inversify";
import UseCaseSymbols from "~/di/UseCaseSymbols.js";
import type ICreateFooUseCase from "./ICreateFooUseCase.js";
import type IGetFooUseCase from "./IGetFooUseCase.js";
import CreateFooUseCase from "./impl/CreateFooUseCase.js";
import GetFooUseCase from "./impl/GetFooUseCase.js";

// Registry augmentation — gives resolveUseCase("foos.CreateFoo") its type
declare module "~/di/UseCaseRegistry.js" {
    interface UseCaseRegistry {
        "foos.CreateFoo": ICreateFooUseCase;
        "foos.GetFoo": IGetFooUseCase;
    }
}

const FoosModule = new ContainerModule((bind) => {
    bind(UseCaseSymbols.foos.CreateFoo)
        .to(CreateFooUseCase)
        .inRequestScope();
    bind(UseCaseSymbols.foos.GetFoo)
        .to(GetFooUseCase)
        .inRequestScope();
});

export default FoosModule;
```

To add a new use case:

1. Add the symbol to `UseCaseSymbols.ts` under the `foos` block.
2. Add the `"<domain>.<UseCase>": IUseCase` line to the `declare
   module` block.
3. Add the `bind(...).to(...).inRequestScope()` line to the
   `ContainerModule` callback.

To add a new domain:

1. Create `useCase/<newDomain>/` with the per-use-case files and a
   `<NewDomain>Module.ts`.
2. Add a new top-level entry to `UseCaseSymbols.ts` (a new object
   under the root constant).
3. Register the module in `di/container.ts`:

```ts
import NewDomainModule from "../useCase/newDomain/NewDomainModule.js";
// ...
container.load(
    CalendarModule,
    CustomersModule,
    MembersModule,
    NewDomainModule,   // ← here
    // ...
);
```

## The `UseCaseRegistry` augmentation trick

The registry file is intentionally empty:

```ts
// di/UseCaseRegistry.ts
// biome-ignore lint/suspicious/noEmptyInterface: extended via module augmentation
export interface UseCaseRegistry {}
```

Each `<Domain>Module.ts` extends it:

```ts
declare module "~/di/UseCaseRegistry.js" {
    interface UseCaseRegistry {
        "foos.CreateFoo": ICreateFooUseCase;
        "foos.GetFoo": IGetFooUseCase;
    }
}
```

TypeScript merges all augmentations of the same interface at compile
time. After every domain module is in the compilation unit (which
happens automatically because `container.ts` imports them), the
registry has every key.

The resolver in `resolveUseCase.ts` uses the registry as a typed
lookup table:

```ts
export function createUseCaseResolver(container: Container) {
    return <K extends keyof UseCaseRegistry>(name: K): UseCaseRegistry[K] =>
        container.get<UseCaseRegistry[K]>(Symbol.for(`UseCase.${name}`));
}
```

`keyof UseCaseRegistry` is now the union of every augmented key
(`"foos.CreateFoo" | "foos.GetFoo" | "members.GetMember" | ...`). The
return type is inferred from the key, so:

```ts
const uc = resolveUseCase("foos.CreateFoo");
// uc is typed as ICreateFooUseCase — autocompletes execute(...)
```

If `resolveUseCase("…")` doesn't autocomplete or the inferred type is
`never`, one of three things has gone wrong:

1. The `<Domain>Module.ts` is not being loaded (check
   `container.ts`'s `container.load(...)` list — TypeScript only sees
   the augmentation when the module is in the compilation).
2. The literal string passed to `resolveUseCase` doesn't match the
   augmented key (typo, wrong domain prefix).
3. The `Symbol.for("UseCase.${name}")` template in `resolveUseCase`
   was edited but the binding in `<Domain>Module.ts` uses
   `UseCaseSymbols.<domain>.<Name>` which has a different string
   key — they have to stay in sync.

## Scope decisions

| Scope | When | Example |
|-------|------|---------|
| `.inSingletonScope()` | Pure / stateless services. One instance for the whole process. | `IClock`, `IExcelCodec`, `ICalendarFeedService`. |
| `.inRequestScope()` | Use cases (new instance per request avoids cross-request state). The unit-of-work / DB context (each request gets its own transactional boundary). | All use cases; the `IUnitOfWork` impl; `IMemberAuthenticator`. |
| `.inTransientScope()` | New instance per `container.get(...)` call. Very rare in this codebase. | None at present. |

`new Container({ defaultScope: "Singleton" })` makes Singleton the
fallback — that's why pure services don't always spell out
`.inSingletonScope()`. Anything that holds per-request state should
override with `.inRequestScope()` explicitly.

A subtle case: `IMemberAuthenticator` is request-scoped because in
the future it may carry per-request context (e.g. the resolved actor
cache). Even if today's impl is stateless, marking it request-scoped
prevents accidentally sharing state if the impl evolves.

## Constructor injection only

```ts
@injectable()
export default class CreateFooUseCase implements ICreateFooUseCase {
    constructor(
        @inject(InternalSymbols.Repo.Foo)
        private readonly fooRepo: IFooRepository,
        @inject(InternalSymbols.Service.Clock)
        private readonly clock: IClock,
    ) {}
}
```

Rules:

- `@injectable()` decorator on every class Inversify binds.
- `@inject(Symbol)` on every constructor parameter.
- `private readonly` — never `public`, never mutable.
- No property injection (`@inject` on a field declaration). It works
  but obscures the dependency contract.
- No service locator (`container.get(...)` inside a method body). The
  use case should be inspectable from its constructor signature alone.

## Adding a new symbol category

You want to introduce, say, `EventHandler` symbols (publishers for
domain events).

1. Add a section to `InternalSymbols.ts`:

```ts
const InternalSymbols = {
    UnitOfWork: Symbol.for("UnitOfWork"),
    Repo: { /* ... */ },
    DomainService: { /* ... */ },
    Service: { /* ... */ },
    EventHandler: {
        MemberCreated: Symbol.for("EventHandler.MemberCreated"),
    },
} as const;
```

2. Declare the port interface in `core/src/event/` (a new top-level
   folder if needed).

3. Bind the impl in a fitting module — either in a new
   `EventHandlersModule.ts` loaded from `container.ts`, or in the
   persistence adapter's `install.ts` (the `installPersistence`
   installer) if the impl is impure.

4. Consume via constructor injection:

```ts
@inject(InternalSymbols.EventHandler.MemberCreated)
private readonly memberCreatedPublisher: IMemberCreatedPublisher,
```

The pattern always follows the same three-step shape: declare the
symbol, declare the port, bind the impl in a `ContainerModule`.

## Anti-patterns to avoid

- **Service locator.** Calling `container.get(Symbols.X)` inside a
  use case body. The dependency becomes invisible to the constructor
  and to tests. Always inject.
- **Property injection.** Field-level `@inject` works but obscures
  the contract.
- **Importing adapter types into core.** If a core file ever needs a
  driver type from the persistence adapter (e.g. `import { PrismaClient }`,
  a Mongo `Collection`, a Drizzle table), you've inverted the
  dependency. Move the adapter-specific bit into the adapter package.
- **Branching on environment inside core.** Core never asks "is this
  the mock environment?". The webapp's composition root decides which
  adapter to load; core stays oblivious.
- **Duplicating a symbol with `Symbol(...)` instead of `Symbol.for(...)`.**
  Two different symbol values means the binding in the adapter and
  the injection in the use case don't match — you get a runtime
  "no binding" error.
- **Forgetting to register a new `<Domain>Module.ts` in `container.ts`.**
  Symptom: `resolveUseCase("yourDomain.YourUseCase")` returns
  `never` at the type level, or throws at runtime.

## "Seen in the wild"

Concrete examples in `task-planning`:

- Symbol file (split): `packages/core/src/di/InternalSymbols.ts`,
  `packages/core/src/di/UseCaseSymbols.ts`
- Registry stub: `packages/core/src/di/UseCaseRegistry.ts`
- Resolver: `packages/core/src/di/resolveUseCase.ts`
- Container bootstrap: `packages/core/src/di/container.ts`
- Per-domain module:
  `packages/core/src/useCase/members/MembersModule.ts`
- Use-case impl with `@inject`:
  `packages/core/src/useCase/members/impl/CreateMemberUseCase.ts`
- Adapter installer (the `installPersistence` export):
  `packages/<db>/src/install.ts` (e.g. `packages/prisma-adapter/` or
  `packages/mongodb-adapter/`)
- Pure-services module:
  `packages/core/src/service/ServicesModule.ts`
- Impure-services installer:
  `packages/core/src/service/impl/installServices.ts`
