import { DatabaseSync } from "node:sqlite";

/**
 * One SQLite connection. Transactions are per connection, so top-level
 * transactions are queued: two requests never interleave inside one.
 */
export default class Database {
    readonly conn: DatabaseSync;
    private queue: Promise<unknown> = Promise.resolve();

    constructor(path = ":memory:") {
        this.conn = new DatabaseSync(path);
        this.conn.exec(SCHEMA);
    }

    exclusive<T>(fn: () => Promise<T>): Promise<T> {
        const run = this.queue.then(fn, fn);
        this.queue = run.catch(() => undefined);
        return run;
    }

    seed() {
        const insert = this.conn.prepare(
            "insert or ignore into member (id, name, email, role, token) values (?, ?, ?, ?, ?)",
        );
        insert.run("m-anna", "Anna", "anna@example.com", "staff", "anna-token");
        insert.run(
            "m-bruno",
            "Bruno",
            "bruno@example.com",
            "staff",
            "bruno-token",
        );
        insert.run(
            "m-carla",
            "Carla",
            "carla@example.com",
            "admin",
            "carla-token",
        );
    }
}

const SCHEMA = `
    create table if not exists member (
        id text primary key,
        name text not null,
        email text not null,
        role text not null check (role in ('staff', 'admin')),
        token text not null unique
    );
    create table if not exists expense (
        id text primary key,
        author_id text not null references member(id),
        description text not null,
        amount_cents integer not null check (amount_cents > 0),
        status text not null,
        created_at text not null
    );
    create table if not exists expense_status_change (
        id integer primary key autoincrement,
        expense_id text not null references expense(id),
        from_status text not null,
        to_status text not null,
        changed_by text not null references member(id),
        changed_at text not null
    );
`;
