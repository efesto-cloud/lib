import {
    Amount,
    Expense,
    type ExpenseStatus,
    type IExpenseRepository,
    Port,
} from "@expenses/core";
import { inject, injectable } from "inversify";
import type Database from "./Database.js";

type Row = {
    id: string;
    author_id: string;
    description: string;
    amount_cents: number;
    status: ExpenseStatus;
    created_at: string;
};

function toEntity(row: Row): Expense {
    return Expense.restore(row.id, {
        author_id: row.author_id,
        description: row.description,
        amount: Amount.fromRaw(row.amount_cents),
        status: row.status,
        created_at: row.created_at,
    });
}

@injectable()
export default class ExpenseRepository implements IExpenseRepository {
    constructor(@inject(Port.Database) private readonly db: Database) {}

    async findById(id: string) {
        const row = this.db.conn
            .prepare("select * from expense where id = ?")
            .get(id) as Row | undefined;
        return row ? toEntity(row) : null;
    }

    async list(filter: { author_id?: string; status?: ExpenseStatus }) {
        const rows = this.db.conn
            .prepare(
                `select * from expense
                 where (:author_id is null or author_id = :author_id)
                   and (:status is null or status = :status)
                 order by created_at`,
            )
            .all({
                author_id: filter.author_id ?? null,
                status: filter.status ?? null,
            }) as Row[];
        return rows.map(toEntity);
    }

    async save(expense: Expense) {
        const dto = expense.toDTO();
        this.db.conn
            .prepare(
                `insert into expense (id, author_id, description, amount_cents, status, created_at)
                 values (?, ?, ?, ?, ?, ?)
                 on conflict (id) do update set description = excluded.description,
                    amount_cents = excluded.amount_cents, status = excluded.status`,
            )
            .run(
                dto.id,
                dto.author_id,
                dto.description,
                dto.amount_cents,
                dto.status,
                dto.created_at,
            );
    }
}
