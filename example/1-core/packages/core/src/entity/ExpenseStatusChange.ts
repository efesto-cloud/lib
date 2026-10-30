import type { ExpenseStatus } from "../type/ExpenseStatus.js";

/** One row of an expense's history, written together with the expense. */
export default interface ExpenseStatusChange {
    readonly expense_id: string;
    readonly from: ExpenseStatus;
    readonly to: ExpenseStatus;
    readonly changed_by: string;
    readonly changed_at: string;
}
