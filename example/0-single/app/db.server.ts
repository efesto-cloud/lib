import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

export function openDb(path = ":memory:"): Db {
    const db = new DatabaseSync(path);
    db.exec(`
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
    `);
    return db;
}

export function seed(db: Db) {
    const insert = db.prepare(
        "insert or ignore into member (id, name, email, role, token) values (?, ?, ?, ?, ?)",
    );
    insert.run("m-anna", "Anna", "anna@example.com", "staff", "anna-token");
    insert.run("m-bruno", "Bruno", "bruno@example.com", "staff", "bruno-token");
    insert.run("m-carla", "Carla", "carla@example.com", "admin", "carla-token");
}
