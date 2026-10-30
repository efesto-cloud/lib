import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import { Port } from "@expenses/core";
import { Result } from "effect";
import { inject, injectable } from "inversify";
import type Database from "./Database.js";

/** Reentrant. Bound in request scope: one instance per resolved use case graph. */
@injectable()
export default class SqliteUnitOfWork implements IUnitOfWork {
    private depth = 0;

    constructor(@inject(Port.Database) private readonly db: Database) {}

    runWithTransaction<A, E>(
        fn: () => Promise<Result.Result<A, E>>,
    ): Promise<Result.Result<A, E>> {
        if (this.depth > 0) return fn();
        return this.db.exclusive(async () => {
            this.depth++;
            this.db.conn.exec("begin");
            try {
                const result = await fn();
                this.db.conn.exec(
                    Result.isSuccess(result) ? "commit" : "rollback",
                );
                return result;
            } catch (error) {
                this.db.conn.exec("rollback");
                throw error;
            } finally {
                this.depth--;
            }
        });
    }
}
