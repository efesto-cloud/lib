import { z } from "zod";
import { EXPENSE_STATUSES } from "../type/ExpenseStatus.js";

export const ExpenseDto = z.object({
    id: z.string(),
    author_id: z.string(),
    description: z.string(),
    amount_cents: z.number(),
    status: z.enum(EXPENSE_STATUSES),
    created_at: z.string(),
});

export type ExpenseDto = z.infer<typeof ExpenseDto>;
