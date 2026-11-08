import type { ExpenseStatus } from "@expenses/contract/type/ExpenseStatus";
import type Expense from "../entity/Expense.js";

export default interface IExpenseRepository {
    findById(id: string): Promise<Expense | null>;
    list(filter: {
        author_id?: string;
        status?: ExpenseStatus;
    }): Promise<Expense[]>;
    save(expense: Expense): Promise<void>;
}
