# @efesto-cloud/unit-of-work

Database-agnostic unit-of-work / transaction boundary. Defines the interface that use cases depend on when they need atomicity — concrete implementations live in each project's database adapter.

## Installation

```bash
pnpm add @efesto-cloud/unit-of-work
```

## API

```ts
interface IUnitOfWork {
    runWithTransaction<A, E>(
        fn: () => Promise<Result<A, E>>,
    ): Promise<Result<A, E>>;
}
```

`Result` is Effect's.

That's the whole contract:

- `runWithTransaction(fn)` — execute `fn` inside a transaction. If `fn` returns a failure or throws, the transaction is rolled back; otherwise committed. Use cases report errors as values, so a failure must roll back just like an exception.
- Nested calls join the outer transaction: a use case may call another one, and only the outermost call commits.
- An implementation that keeps the current transaction on the instance must live for one request, not as a singleton, or two concurrent requests share it.

## Usage

Depend on `IUnitOfWork` from your application layer — not on a concrete driver. This keeps use cases testable and lets you swap database adapters.

```ts
import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";

class CreatePost {
    constructor(private readonly uow: IUnitOfWork) {}

    async execute(input: Input) {
        return this.uow.runWithTransaction(async () => {
            // …load, mutate, save…
        });
    }
}
```

## Adapters

- [`@efesto-cloud/mongodb-unit-of-work`](../mongodb-unit-of-work) — MongoDB implementation backed by `ClientSession.withTransaction`.
- [`@efesto-cloud/prisma-unit-of-work`](../prisma-unit-of-work) — Prisma implementation backed by `prisma.$transaction`.
