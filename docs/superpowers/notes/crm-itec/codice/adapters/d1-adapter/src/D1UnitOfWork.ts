import ConflictError from "@itec/contract/errors/ConflictError";
import type Entity from "@itec/core/entity/Entity";
import type IUnitOfWork from "@itec/core/repo/IUnitOfWork";
import { type Err, Result } from "better-result";

const ATTEMPTS = 3;

/**
 * Qualcuno ha scritto prima: la `v` letta non c'è più (`CASE` → `NULL` su una
 * colonna `NOT NULL`), o la riga nuova c'è già.
 */
const isConflict = (error: unknown) =>
    /NOT NULL constraint failed: \w+\.v\b|UNIQUE constraint failed/.test(
        String(error),
    );

interface Write {
    /** Se c'è, la prima istruzione è l'`UPDATE` controllato sulla sua `v`. */
    updated?: Entity<unknown, unknown>;
    statements: () => D1PreparedStatement[];
}

/**
 * La Unit of Work su D1 (docs/adr/0011): la coda è un `db.batch()`, l'unica
 * transazione di D1. Uno per esecuzione di use case (`inRequestScope`).
 */
export default class D1UnitOfWork implements IUnitOfWork {
    private queue: Map<object, Write> | undefined;

    constructor(readonly db: D1Database) {}

    /**
     * Accoda la scrittura di `entity`, una sola anche se si salva più volte:
     * le istruzioni si costruiscono alla fine, con l'ultimo stato.
     */
    save(
        entity: Entity<unknown, unknown>,
        statements: () => D1PreparedStatement[],
    ): void {
        this.writes().set(entity, {
            updated: entity.isNew() || entity.isRemoved() ? undefined : entity,
            statements,
        });
    }

    /** Accoda una riga di un registro, che si scrive insieme alle entity. */
    append(statement: D1PreparedStatement): void {
        this.writes().set({}, { statements: () => [statement] });
    }

    /** Fa fallire il batch se la riga non ha più la versione `v`. */
    checkVersion(
        table: string,
        key: string,
        entity: Entity<unknown, unknown>,
    ): D1PreparedStatement {
        return this.db
            .prepare(
                `UPDATE "${table}" SET v = CASE WHEN v = ? THEN v + 1 END WHERE "${key}" = ?`,
            )
            .bind(entity.v, entity.id);
    }

    private writes(): Map<object, Write> {
        if (!this.queue)
            throw new Error(
                "Un save fuori da runWithTransaction andrebbe perso",
            );
        return this.queue;
    }

    async runWithTransaction<R extends Result<unknown, unknown>>(
        work: () => Promise<R>,
    ): Promise<R | Err<never, ConflictError>> {
        if (this.queue)
            throw new Error(
                "runWithTransaction è già in corso su questa Unit of Work",
            );
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
            // Una riga che intanto non c'è più si vede solo dai conteggi, a
            // batch confermato: il resto è scritto, e non si ripete.
            return committed === "ok"
                ? result
                : Result.err(new ConflictError());
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
        return checked.every((i) => results[i]?.meta.changes === 1)
            ? "ok"
            : "gone";
    }
}
