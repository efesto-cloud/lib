import {
    type ExpenseStatusChange,
    type IExpenseStatusChangeRepository,
    Port,
} from "@expenses/core";
import { inject, injectable } from "inversify";
import type Database from "./Database.js";

@injectable()
export default class ExpenseStatusChangeRepository
    implements IExpenseStatusChangeRepository
{
    constructor(@inject(Port.Database) private readonly db: Database) {}

    async add(change: ExpenseStatusChange) {
        this.db.conn
            .prepare(
                "insert into expense_status_change (expense_id, from_status, to_status, changed_by, changed_at) values (?, ?, ?, ?, ?)",
            )
            .run(
                change.expense_id,
                change.from,
                change.to,
                change.changed_by,
                change.changed_at,
            );
    }

    async listByExpense(expense_id: string) {
        return this.db.conn
            .prepare(
                `select expense_id, from_status as "from", to_status as "to", changed_by, changed_at
                 from expense_status_change where expense_id = ? order by id`,
            )
            .all(expense_id) as unknown as ExpenseStatusChange[];
    }
}
