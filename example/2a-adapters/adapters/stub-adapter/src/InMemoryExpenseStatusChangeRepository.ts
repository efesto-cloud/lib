import type {
    ExpenseStatusChange,
    IExpenseStatusChangeRepository,
} from "@expenses/core";
import type StubStore from "./StubStore.js";

export default class InMemoryExpenseStatusChangeRepository
    implements IExpenseStatusChangeRepository
{
    constructor(private readonly store: StubStore) {}

    async add(change: ExpenseStatusChange) {
        this.store.state.changes.push({ ...change });
    }

    async listByExpense(expense_id: string) {
        return this.store.state.changes.filter(
            (c) => c.expense_id === expense_id,
        );
    }
}
