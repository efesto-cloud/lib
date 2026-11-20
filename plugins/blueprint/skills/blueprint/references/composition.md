# Container, install and composition root

## Who does what

| Who | What |
|---|---|
| composition root (`apps/*`, the seed, every test that builds a container) | creates the container, calls the core's `install`, loads the installs of the adapters it chose with their configuration, binds the services the core implements itself, builds the resolver |
| core | exposes `install(container): void` and `createUseCaseResolver(container): UseCaseResolver`. It never creates a container and has no singleton |
| adapter | exports `install<Technology>(opts): ContainerModule` with its bindings; configuration comes in through `opts` |

One container per composition root. Two processes that talk to each other in a
test keep two containers: a single one would bind both sides' ports together
and hide what is missing in production.

## Symbols

```ts
// core/src/di/InternalSymbols.ts
const InternalSymbols = {
    UnitOfWork: Symbol.for("UnitOfWork"),
    Repo: {
        Expense: Symbol.for("Repo.Expense"),
        Member: Symbol.for("Repo.Member"),
    },
    Service: {
        PasswordHasher: Symbol.for("Service.PasswordHasher"),
    },
} as const;

export default InternalSymbols;
```

Ports and services use these symbols. Use cases are bound under their registry
key string (`"expenses.ApproveExpense"`), which is also how another use case
injects them.

## The core's install

```ts
// core/src/di/useCaseModule.ts
/** One implementation per use case of `R`: a missing or wrong one does not compile. */
export type UseCaseImplementations<R> = {
    [K in keyof R]: new (...args: never[]) => R[K];
};

/** Binds every use case to its registry key, one instance per resolution. */
export function useCaseModule<R>(implementations: UseCaseImplementations<R>): ContainerModule {
    return new ContainerModule((bind) => {
        for (const key in implementations) {
            bind(key).to(implementations[key]).inRequestScope();
        }
    });
}
```

```ts
// core/src/di/install.ts
/** Loads the core's use cases on the composition root's container. Adapters are bound by the root. */
export function install(container: Container): void {
    container.load(
        useCaseModule<UseCaseRegistry>({
            ...ExpensesModule,
            ...MembersModule,
        }),
    );
}
```

```ts
// core/src/di/resolveUseCase.ts
export function createUseCaseResolver(container: Container): UseCaseResolver {
    return <K extends keyof UseCaseRegistry>(key: K) => container.get<UseCaseRegistry[K]>(key);
}
```

Each `resolveUseCase(key)` is a new resolution, hence a new Unit of Work (see
`persistence.md`).

## An adapter's install

```ts
// adapters/d1-adapter/src/installD1.ts
/** The Unit of Work and the repositories, one per resolution: whoever receives the `uow` cannot live longer. */
export function installD1({ DB }: { DB: D1Database }): ContainerModule {
    return new ContainerModule((bind) => {
        bind(InternalSymbols.UnitOfWork)
            .toDynamicValue(() => new D1UnitOfWork(DB))
            .inRequestScope();
        bind(InternalSymbols.Repo.Expense).to(ExpenseRepoImpl).inRequestScope();
        bind(InternalSymbols.Repo.Member).to(MemberRepoImpl).inRequestScope();
    });
}
```

What receives the `uow` is `inRequestScope` and built by Inversify
(`@injectable()`, `.to(…)`). What does not can be a constant
(`toConstantValue(new …)`).

## The composition root

```ts
// apps/webapp/workers/bootstrap.ts
// One container for the whole Worker; `env` only exists in a request, so it is built on first use.
let resolveUseCase: UseCaseResolver | undefined;

export function getResolveUseCase(env: Env): UseCaseResolver {
    if (!resolveUseCase) {
        const container = new Container({ defaultScope: "Singleton" });
        install(container);
        container.load(installD1({ DB: env.DB }));
        container
            .bind<IPasswordHasher>(InternalSymbols.Service.PasswordHasher)
            .to(Pbkdf2PasswordHasher);
        resolveUseCase = createUseCaseResolver(container);
    }
    return resolveUseCase;
}
```

A Node process does the same at startup, after checking that its environment
variables are all present (and exiting with the list of the missing ones).

## Validation at the edge

The caller passes raw data through the contract's schema, **only where raw
data enters**: an action's `FormData`, a request's query or params, a channel's
JSON. Invalid input is a 400 and the use case is not called. Where the value is
already typed (the session's user, a constant, the seed) it is not revalidated,
and the use case never revalidates the shape.

A webapp has a **wire schema** in front of the contract's: it turns form strings
into values, then `.pipe`s into the use case's schema.

```ts
// apps/webapp/app/input.server.ts
/** The data according to the schema, or a 400. */
function read<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw data("Invalid request", { status: 400 });
    return parsed.data;
}

/** One string per name, a list for repeated names (Object.fromEntries would keep the last). */
function fields(entries: Iterable<[string, FormDataEntryValue]>) { /* … */ }

export const readForm = async <S extends z.ZodType>(request: Request, schema: S) =>
    read(schema, fields(await request.formData()));
export const readQuery = <S extends z.ZodType>(request: Request, schema: S) =>
    read(schema, fields(new URL(request.url).searchParams));
export const readParams = <S extends z.ZodType>(params: unknown, schema: S) => read(schema, params);

/** Wire helpers: optional text, decimal with comma or dot, yes/no, checkbox, repeated field, JSON. */
export const text = z.string().transform((v) => v || null).default(null);
export const decimal = z.string().trim().regex(/^(-?\d*[.,]?\d+)?$/)
    .transform((v) => (v ? Number(v.replace(",", ".")) : null)).default(null);
export const checkbox = z.literal("on").optional().transform((v) => v !== undefined);
export const list = <T extends z.ZodType>(item: T) =>
    z.preprocess((v) => (v === undefined ? [] : [v].flat()), z.array(item));
```

```ts
// in an action
const input = await readForm(
    request,
    z.object({ expense_id: z.string(), amount: decimal }).pipe(UpdateExpenseInput),
);
const result = await getResolveUseCase(env)("expenses.UpdateExpense").execute(input, ctx);
```

## Inversify

Inversify and its decorators stay. A future move to another container stays
possible as long as the core uses only constructor injection with its own
symbols, nothing container-specific, and all bindings live in modules and
composition roots.
