import { DatabaseSync } from "node:sqlite";
import type { UseCaseInput, UseCaseKey } from "@expenses/contract/registry";
import type { ExecutionContext } from "@expenses/contract/useCase";
import type IJobQueue from "@expenses/core/service/IJobQueue";
import type { IJobSource, Job } from "@expenses/core/service/IJobQueue";

/**
 * A queue in its own SQLite file. It stands in for a managed queue; the
 * consumer pulls from it. Retries and concurrency are left to the project.
 */
export default class SqliteJobQueue implements IJobQueue, IJobSource {
    private readonly conn: DatabaseSync;

    constructor(path: string) {
        this.conn = new DatabaseSync(path);
        this.conn.exec(
            "create table if not exists job (id integer primary key autoincrement, payload text not null)",
        );
    }

    async enqueue<K extends UseCaseKey>(
        key: K,
        input: UseCaseInput<K>,
        context: ExecutionContext,
    ) {
        this.conn
            .prepare("insert into job (payload) values (?)")
            .run(JSON.stringify({ key, input, context }));
    }

    async next() {
        const row = this.conn
            .prepare(
                "delete from job where id = (select min(id) from job) returning payload",
            )
            .get() as { payload: string } | undefined;
        return row ? (JSON.parse(row.payload) as Job) : null;
    }
}
