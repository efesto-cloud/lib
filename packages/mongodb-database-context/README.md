# @efesto-cloud/mongodb-database-context

MongoDB implementation of [`IDatabaseContext`](../database-context). Wraps a `MongoClient` and exposes a `ClientSession` that repositories can use for session-scoped reads/writes inside `runWithTransaction`.

## Installation

```bash
pnpm add @efesto-cloud/mongodb-database-context @efesto-cloud/database-context mongodb
```

## Quick Start

```ts
import { MongoClient } from "mongodb";
import MongoDBContext from "@efesto-cloud/mongodb-database-context/MongoDBContext";

const client = new MongoClient(process.env.MONGO_URL!);
await client.connect();

const db = new MongoDBContext(client);

await db.runWithTransaction(async () => {
    await coll.updateOne(
        { _id: id },
        { $set: { … } },
        { session: db.session },   // pass the session to every op
    );
});
```

## API

```ts
interface IMongoDBContext extends IDatabaseContext {
    readonly session: ClientSession | undefined; // active session, if any
    readonly sessionOrNull: ClientSession | null;

    runWithTransaction<T>(fn: () => Promise<T>): Promise<T>;
}
```

- `session` / `sessionOrNull` — the currently active `ClientSession`. Pass it as `{ session }` to every MongoDB operation so reads/writes participate in the transaction.
- `runWithTransaction(fn)` — starts a session and wraps `fn` in `session.withTransaction`. If a transaction is already running (nested call), it reuses the outer one and just invokes `fn`.

## Notes

- The session is started lazily on the first `runWithTransaction` call and ended when the outermost call returns.
- Nesting is safe: inner `runWithTransaction` calls run within the outer transaction without starting a new one.
- Repositories should always thread `db.session` into their MongoDB calls — forgetting to do so opts that operation out of the transaction.
