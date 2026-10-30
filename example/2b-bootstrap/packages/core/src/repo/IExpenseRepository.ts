import type Expense from "../entity/Expense.js";
import type { ExpenseStatus } from "../type/ExpenseStatus.js";

export default interface IExpenseRepository {
    findById(id: string): Promise<Expense | null>;
    list(filter: {
        author_id?: string;
        status?: ExpenseStatus;
    }): Promise<Expense[]>;
    save(expense: Expense): Promise<void>;
}
