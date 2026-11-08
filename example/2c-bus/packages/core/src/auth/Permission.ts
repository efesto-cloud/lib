import type { Role } from "@expenses/contract/type/Role";

export type Permission =
    | "expenses.create"
    | "expenses.review"
    | "expenses.reimburse"
    | "expenses.import";

export const PERMISSIONS: Record<Role, readonly Permission[]> = {
    staff: ["expenses.create"],
    admin: [
        "expenses.create",
        "expenses.review",
        "expenses.reimburse",
        "expenses.import",
    ],
};
