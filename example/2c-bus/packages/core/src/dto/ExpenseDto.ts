import { Schema } from "effect";
import { EXPENSE_STATUSES } from "../type/ExpenseStatus.js";

export const ExpenseDto = Schema.Struct({
    id: Schema.String,
    author_id: Schema.String,
    description: Schema.String,
    amount_cents: Schema.Number,
    status: Schema.Literals(EXPENSE_STATUSES),
    created_at: Schema.String,
});

export type ExpenseDto = typeof ExpenseDto.Type;
