# @efesto-cloud/unit-of-work

Database-agnostic unit-of-work / transaction boundary. Defines the interface that use cases depend on when they need atomicity — concrete implementations live in the adapter packages (e.g. [`@efesto-cloud/mongodb-unit-of-work`](../mongodb-unit-of-work)).

## Installation

```bash
pnpm add @efesto-cloud/unit-of-work
```

## API

```ts
interface IUnitOfWork {
    runWithTransaction<T>(fn: () => Promise<T>): Promise<T>;
}
```

That's the whole contract:

- `runWithTransaction(fn)` — execute `fn` inside a transaction. If `fn` throws, the transaction is rolled back; otherwise committed. Nested calls must be safe (the implementation should reuse the outer transaction).

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
