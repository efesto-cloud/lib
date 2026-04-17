# @efesto-cloud/database-context

Database-agnostic transaction abstraction. Defines the interface that use cases depend on when they need atomicity — concrete implementations live in the adapter packages (e.g. [`@efesto-cloud/mongodb-database-context`](../mongodb-database-context)).

## Installation

```bash
pnpm add @efesto-cloud/database-context
```

## API

```ts
interface IDatabaseContext {
    runWithTransaction<T>(fn: () => Promise<T>): Promise<T>;
}
```

That's the whole contract:

- `runWithTransaction(fn)` — execute `fn` inside a transaction. If `fn` throws, the transaction is rolled back; otherwise committed. Nested calls must be safe (the implementation should reuse the outer transaction).

## Usage

Depend on `IDatabaseContext` from your application layer — not on a concrete driver. This keeps use cases testable and lets you swap database adapters.

```ts
import type { IDatabaseContext } from "@efesto-cloud/database-context";

class CreatePost {
    constructor(private readonly db: IDatabaseContext) {}

    async execute(input: Input) {
        return this.db.runWithTransaction(async () => {
            // …load, mutate, save…
        });
    }
}
```

## Adapters

- [`@efesto-cloud/mongodb-database-context`](../mongodb-database-context) — MongoDB implementation backed by `ClientSession.withTransaction`.
