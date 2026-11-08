import type { ExpenseStatus } from "../type/ExpenseStatus.js";

const NEXT: Record<ExpenseStatus, readonly ExpenseStatus[]> = {
    draft: ["submitted"],
    submitted: ["approved", "rejected"],
    approved: ["reimbursed"],
    rejected: [],
    reimbursed: [],
};

/** Pure, so the client can use it to decide which buttons to show. */
export function canTransition(from: ExpenseStatus, to: ExpenseStatus): boolean {
    return NEXT[from].includes(to);
}
