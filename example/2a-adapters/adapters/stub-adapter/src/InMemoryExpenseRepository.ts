import {
    Amount,
    Expense,
    type ExpenseDto,
    type ExpenseStatus,
    type IExpenseRepository,
} from "@expenses/core";
import type StubStore from "./StubStore.js";

/**
 * Honours the constraints of the real table: positive amount, existing
 * author. A fake that accepts what the database refuses hides bugs.
 */
export default class InMemoryExpenseRepository implements IExpenseRepository {
    constructor(private readonly store: StubStore) {}

    async findById(id: string) {
        const row = this.store.state.expenses.get(id);
        return row ? toEntity(row) : null;
    }

    async list(filter: { author_id?: string; status?: ExpenseStatus }) {
        return [...this.store.state.expenses.values()]
            .filter(
                (row) =>
                    !filter.author_id || row.author_id === filter.author_id,
            )
            .filter((row) => !filter.status || row.status === filter.status)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map(toEntity);
    }

    async save(expense: Expense) {
        const row = expense.toDTO();
        if (row.amount_cents <= 0)
            throw new Error("check constraint failed: amount_cents > 0");
        if (!this.store.state.members.has(row.author_id)) {
            throw new Error("foreign key constraint failed: author_id");
        }
        this.store.state.expenses.set(row.id, row);
    }
}

function toEntity(row: ExpenseDto): Expense {
    return Expense.restore(row.id, {
        author_id: row.author_id,
        description: row.description,
        amount: Amount.fromRaw(row.amount_cents),
        status: row.status,
        created_at: row.created_at,
    });
}
