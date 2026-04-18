# @efesto-cloud/prisma-database-context

Prisma implementation of [`IDatabaseContext`](../database-context). Wraps a `PrismaClient` and exposes the current client (root or transactional `tx`) for repositories to use inside `runWithTransaction`.

## Installation

```bash
pnpm add @efesto-cloud/prisma-database-context @efesto-cloud/database-context @prisma/client
```

## Quick Start

```ts
import { PrismaClient } from "@prisma/client";
import PrismaContext from "@efesto-cloud/prisma-database-context/PrismaContext";

const prisma = new PrismaClient();
const db = new PrismaContext(prisma);

await db.runWithTransaction(async () => {
    await db.client.user.update({ where: { id }, data: { … } });
});
```

## API

```ts
interface IPrismaContext<TClient extends PrismaClient = PrismaClient> extends IDatabaseContext {
    readonly client: TClient | PrismaTx; // transactional tx inside runWithTransaction, else root

    runWithTransaction<T>(fn: () => Promise<T>): Promise<T>;
}
```

- `client` — always use this from repositories. Outside a transaction it's the root `PrismaClient`; inside `runWithTransaction` it's the Prisma `tx` passed to `$transaction`'s callback.
- `runWithTransaction(fn)` — wraps `fn` in `prisma.$transaction`. If a transaction is already running (nested call), it reuses the outer one and just invokes `fn`.

## Notes

- Prisma manages the transaction lifecycle; no explicit session open/close is needed.
- Nesting is safe: inner `runWithTransaction` calls run within the outer transaction without opening a new one, so they commit/rollback atomically with the outermost call.
- Repositories should always go through `db.client` — using the root `PrismaClient` directly opts that operation out of the transaction.
