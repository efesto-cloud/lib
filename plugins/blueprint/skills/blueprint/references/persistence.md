# Entity, repository and Unit of Work

This is the standard practice of hexagonal architecture with a Unit of Work
(Fowler, PoEAA) and optimistic locking, written by hand because no ORM covers
D1, Postgres, SQLite and MongoDB well at once. The contract below is the same on
every database; the SQL shown is the one that also works where transactions are
not interactive (D1, which only has `batch()`).

## Entity

The base lives in the project's core (not in an external package):

```ts
// core/src/entity/Entity.ts
/**
 * `v` is the version of the row that was read: 0 for a new entity, then the
 * repository's mapper loads it, and saving checks it. Use cases never touch it.
 */
export default abstract class Entity<P, Id = string> {
    private removed = false;

    constructor(
        readonly id: Id,
        protected props: P,
        readonly v: number,
    ) {}

    isNew(): boolean {
        return this.v === 0;
    }

    /** The next `save` deletes it for real. */
    isRemoved(): boolean {
        return this.removed;
    }

    /** Only for entities the domain deletes for real, without `deleted_at`. */
    protected remove(): void {
        this.removed = true;
    }
}
```

```ts
// core/src/entity/Expense.ts
export default class Expense extends Entity<ExpenseProps> {
    static create(props: NewExpense): Result<Expense, InvalidAmountError> {
        if (props.amount <= 0) return Result.err(new InvalidAmountError());
        return Result.ok(new Expense(crypto.randomUUID(), { ...props, state: "draft" }, 0));
    }

    approve(now: Date): Result<void, InvalidTransitionError> { /* changes this.props */ }

    toDTO(): IExpense { /* … */ }
}
```

- Constructor `(id, props, v)` is for the mapper; `static create(…)` passes
  `v = 0` and may return a `Result`. Methods change `props`.
- `Entity<P, number>` when the id is a number.
- **`deleted_at` means soft deletion and is a domain decision, not a default.**
  `created_at` and `updated_at` are added when needed, with a reason.
- An entity deleted for real exposes a domain method (`close()`, `reset()`)
  that calls `remove()`.

### When something is an entity

Not every table needs an entity. Append-only registers (logs, status history)
are not entities: their row is queued in the same Unit of Work (`append`) and
written together with the entities.

## Repository port

```ts
// core/src/repo/IExpenseRepository.ts
export default interface IExpenseRepository {
    findById(id: string): Promise<Expense | null>;
    listByMember(member_id: string): Promise<Expense[]>;
    save(expense: Expense): void;
}
```

- The reads the use cases need, and **one `save(entity): void`** that queues,
  does not write.
- For what is not an entity the port has the method it needs (`add` for a
  register, `replaceAll` for a configuration table), and it queues too. A port
  that writes immediately, outside the Unit of Work, is an exception that needs
  a reason in an ADR.

## Unit of Work port

```ts
// core/src/repo/IUnitOfWork.ts
/**
 * The Unit of Work of one use case execution. Inside `work` the repositories'
 * `save` queue instead of writing, and reads do not see the queue; at the end
 * the queue is written all or nothing, even when `work` returns an error, and
 * dropped only if `work` throws. If someone wrote the same rows meanwhile,
 * `work` runs again from the start, a fixed number of times, then
 * `ConflictError` remains.
 */
export default interface IUnitOfWork {
    runWithTransaction<R extends Result<unknown, unknown>>(
        work: () => Promise<R>,
    ): Promise<R | Err<never, ConflictError>>;
}
```

The port is minimal. `save`, `append` and version checks belong to the
adapter's implementation; repositories receive that concrete type.

## The save contract

| Entity state | Statement |
|---|---|
| new (`isNew()`) | `INSERT … v = 1`. An id that already exists is a **conflict**, never an overwrite: no upsert |
| removed (`isRemoved()`) | version check, then `DELETE`. A row already gone is not a conflict |
| otherwise | `UPDATE` with the version check |

- An entity saved twice in one execution is written once, with its last state:
  statements are built at commit time.
- `work` reads, decides, then writes. Reads inside `work` do not see the queue.
- A `save` is the decision to write: the queue is written even when `work`
  returns an error (a failed login still counts the attempt). It is dropped only
  if `work` throws.

### Version check that works without interactive transactions

```sql
-- column: v INTEGER NOT NULL DEFAULT 1
-- on an existing table: ALTER TABLE … ADD COLUMN v INTEGER NOT NULL DEFAULT 1
UPDATE "Expense" SET amount = ?, state = ?, v = CASE WHEN v = ?read THEN v + 1 END WHERE id = ?
```

With a stale version the `CASE` yields `NULL`, the `NOT NULL` constraint fails
the `UPDATE`, and the database rolls back the whole batch. Counting affected
rows is enough only where the transaction is interactive (Postgres, SQLite); on
D1 counts arrive after the batch has committed.

### Conflicts and retries

- A stale version or a violated unique constraint fail the whole transaction.
  The adapter recognises them from the constraint error; any other failure is
  an exception.
- `work` runs again from the start: it rereads, the use case's `if`s check
  again, it queues again. **Three attempts in total**, then `ConflictError`
  (from the contract), which therefore belongs to the `Error` of every use case
  that writes.
- A row deleted meanwhile makes the `UPDATE` touch nothing, which shows only in
  the counts after commit: the rest is written and `ConflictError` comes back
  without retrying.

### Who wins

- **Default: the last write wins** between people, as in most business
  software. No `v` travels through forms.
- **"Either it goes or it fails"**: when a person decides on what they saw (a
  state transition, an approval above a threshold), the `v` they saw comes in
  the input. The use case compares it with the `v` read inside `work` and
  returns `Outdated<X>Error`. The retry stays on: it rereads and returns the
  domain error.

```ts
export const ApproveExpenseInput = z.object({ expense_id: z.string(), v: z.number().int(), now: z.date() });

return this.uow.runWithTransaction(async () => {
    const expense = await this.expenses.findById(expense_id);
    if (!expense) return Result.err(new ExpenseNotFoundError());
    if (expense.v !== v) return Result.err(new OutdatedExpenseError());
    // …
});
```

### Constraints

- Put the unique constraint on the thing that must be unique, not on a value
  that contains it: a sequence number has its own column and its own `UNIQUE`.
- With soft deletion the constraint is partial:
  `UNIQUE … WHERE deleted_at IS NULL`.
- A user-chosen code as primary key makes uniqueness and conflict coincide: the
  retry rereads and returns the right domain error (`<X>TakenError`).
- **The version protects one row, not a rule across rows** ("at least one
  administrator remains"). Check such a rule inside the transaction, in the same
  `CASE`: `CASE WHEN v = ? AND (subquery) THEN v + 1 END`; or with an entity
  that holds the rule.

## Guards

- A `save` outside `runWithTransaction` throws: it would be lost.
- Two overlapping `runWithTransaction` on the same `uow` throw.
- A use case resolved once and executed twice in sequence reuses the `uow`,
  which empties at each round.

## Names and scope

- Port `IUnitOfWork`, symbol `InternalSymbols.UnitOfWork`, variable always
  `uow`. Never "DatabaseContext".
- One Unit of Work per use case execution: Inversify's `inRequestScope` is one
  resolution (`container.get`), and every `resolveUseCase(key)` is a new one.
  The Unit of Work, the use cases and the repositories that receive the `uow`
  are `inRequestScope`. A repository bound as a singleton would keep the first
  request's `uow` forever.

## Reference implementation on D1

```ts
// adapters/d1-adapter/src/D1UnitOfWork.ts
const ATTEMPTS = 3;

/** Someone wrote first: the read `v` is gone (CASE → NULL on a NOT NULL column), or the new row exists. */
const isConflict = (error: unknown) =>
    /NOT NULL constraint failed: \w+\.v\b|UNIQUE constraint failed/.test(String(error));

interface Write {
    /** If present, the first statement is the version-checked UPDATE. */
    updated?: Entity<unknown, unknown>;
    statements: () => D1PreparedStatement[];
}

export default class D1UnitOfWork implements IUnitOfWork {
    private queue: Map<object, Write> | undefined;

    constructor(readonly db: D1Database) {}

    /** Queues the write of `entity`, once even if saved several times. */
    save(entity: Entity<unknown, unknown>, statements: () => D1PreparedStatement[]): void {
        this.writes().set(entity, {
            updated: entity.isNew() || entity.isRemoved() ? undefined : entity,
            statements,
        });
    }

    /** Queues a register row, written together with the entities. */
    append(statement: D1PreparedStatement): void {
        this.writes().set({}, { statements: () => [statement] });
    }

    /** Fails the batch if the row no longer has version `v`. */
    checkVersion(table: string, key: string, entity: Entity<unknown, unknown>): D1PreparedStatement {
        return this.db
            .prepare(`UPDATE "${table}" SET v = CASE WHEN v = ? THEN v + 1 END WHERE "${key}" = ?`)
            .bind(entity.v, entity.id);
    }

    private writes(): Map<object, Write> {
        if (!this.queue) throw new Error("A save outside runWithTransaction would be lost");
        return this.queue;
    }

    async runWithTransaction<R extends Result<unknown, unknown>>(
        work: () => Promise<R>,
    ): Promise<R | Err<never, ConflictError>> {
        if (this.queue) throw new Error("runWithTransaction already running on this Unit of Work");
        for (let attempt = 1; ; attempt++) {
            const queue = new Map<object, Write>();
            this.queue = queue;
            let result: R;
            try {
                result = await work();
            } finally {
                this.queue = undefined;
            }
            const committed = await this.commit([...queue.values()]);
            if (committed === "conflict" && attempt < ATTEMPTS) continue;
            // A row gone meanwhile shows only in the counts, after commit: the rest is written.
            return committed === "ok" ? result : Result.err(new ConflictError());
        }
    }

    private async commit(writes: Write[]): Promise<"ok" | "conflict" | "gone"> {
        const statements: D1PreparedStatement[] = [];
        const checked: number[] = [];
        for (const write of writes) {
            if (write.updated) checked.push(statements.length);
            statements.push(...write.statements());
        }
        if (statements.length === 0) return "ok";
        let results: D1Result[];
        try {
            results = await this.db.batch(statements);
        } catch (error) {
            if (isConflict(error)) return "conflict";
            throw error;
        }
        return checked.every((i) => results[i]?.meta.changes === 1) ? "ok" : "gone";
    }
}
```

```ts
// adapters/d1-adapter/src/ExpenseRepoImpl.ts
interface ExpenseRow { id: string; amount: number; state: ExpenseState; v: number }

const toExpense = ({ id, v, ...props }: ExpenseRow) => new Expense(id, props, v);

@injectable()
export default class ExpenseRepoImpl implements IExpenseRepository {
    private readonly db: D1Database;

    constructor(@inject(InternalSymbols.UnitOfWork) private readonly uow: D1UnitOfWork) {
        this.db = uow.db;
    }

    async findById(id: string): Promise<Expense | null> {
        const row = await this.db.prepare(`SELECT * FROM "Expense" WHERE id = ?`).bind(id).first<ExpenseRow>();
        return row && toExpense(row);
    }

    save(expense: Expense): void {
        this.uow.save(expense, () => [
            expense.isNew()
                ? this.db
                      .prepare(`INSERT INTO "Expense" (id, amount, state, v) VALUES (?, ?, ?, 1)`)
                      .bind(expense.id, expense.amount, expense.state)
                : this.db
                      .prepare(`UPDATE "Expense" SET amount = ?, state = ?, v = CASE WHEN v = ? THEN v + 1 END WHERE id = ?`)
                      .bind(expense.amount, expense.state, expense.v, expense.id),
        ]);
    }
}
```

For an entity that can be removed, `save` emits `uow.checkVersion(…)` followed
by the `DELETE` when `isRemoved()`.

## Adding an entity

1. `core/src/entity/<Entity>.ts`, `extends Entity<Props>`.
2. Its port `core/src/repo/I<Entity>Repository.ts` with the reads and
   `save(entity): void`; a symbol in `InternalSymbols.Repo`.
3. The adapter's repository: `@injectable()`, receives the concrete Unit of Work
   with `@inject(InternalSymbols.UnitOfWork)`, the mapper passes `row.v`, `save`
   calls `uow.save(entity, () => [statements])`.
4. One line in the adapter's install: `.to(<Entity>RepoImpl).inRequestScope()`.
5. The column `v INTEGER NOT NULL DEFAULT 1` in the table (Prisma migration;
   on an existing table, `ALTER TABLE … ADD COLUMN`).
6. Its save-contract test (see `testing.md`).
