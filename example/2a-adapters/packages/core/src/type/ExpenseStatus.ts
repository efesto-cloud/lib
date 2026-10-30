export const EXPENSE_STATUSES = [
    "draft",
    "submitted",
    "approved",
    "rejected",
    "reimbursed",
] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
