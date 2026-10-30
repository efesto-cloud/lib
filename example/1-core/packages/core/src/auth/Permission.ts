import type { Role } from "../type/Role.js";

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
