# @efesto-cloud/prisma-database-context

Prisma implementation of [`IDatabaseContext`](../database-context). Wraps a Prisma-like client and exposes the current client (root or transactional `tx`) for repositories to use inside `runWithTransaction`.

The client is typed structurally via `PrismaLikeClient` — the package has no direct dependency on `@prisma/client`, so any object with a compatible `$transaction` method works (the real `PrismaClient` being the usual case).

## Installation

```bash
pnpm add @efesto-cloud/prisma-database-context @efesto-cloud/database-context
# plus your Prisma client, typically:
pnpm add @prisma/client
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
interface PrismaLikeClient<TTx = object> {
    $transaction<T>(fn: (tx: TTx) => Promise<T>): Promise<T>;
}

type PrismaTxOf<TClient> = Omit<TClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

interface IPrismaContext<
    TClient extends PrismaLikeClient<PrismaTxOf<TClient>> = PrismaLikeClient,
> extends IDatabaseContext {
    readonly client: TClient | PrismaTxOf<TClient>; // transactional tx inside runWithTransaction, else root
}
```

- `client` — always use this from repositories. Outside a transaction it's the root client; inside `runWithTransaction` it's the Prisma `tx` passed to `$transaction`'s callback (typed as `PrismaTxOf<TClient>`, i.e. the client minus the management methods).
- `runWithTransaction(fn)` — inherited from `IDatabaseContext`. Wraps `fn` in `prisma.$transaction`. If a transaction is already running (nested call), it reuses the outer one and just invokes `fn`.
- `PrismaLikeClient` / `PrismaTxOf` are re-exported so you can type custom clients (e.g. extended Prisma clients) precisely.

## Notes

- Prisma manages the transaction lifecycle; no explicit session open/close is needed.
- Nesting is safe: inner `runWithTransaction` calls run within the outer transaction without opening a new one, so they commit/rollback atomically with the outermost call.
- Repositories should always go through `db.client` — using the root `PrismaClient` directly opts that operation out of the transaction.
