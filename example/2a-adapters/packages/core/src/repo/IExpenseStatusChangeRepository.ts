import type ExpenseStatusChange from "../entity/ExpenseStatusChange.js";

export default interface IExpenseStatusChangeRepository {
    add(change: ExpenseStatusChange): Promise<void>;
    listByExpense(expense_id: string): Promise<ExpenseStatusChange[]>;
}
