import { Schema } from "effect";

export default class ExpenseNotFound extends Schema.TaggedError<ExpenseNotFound>()(
    "ExpenseNotFound",
    {
        expense_id: Schema.String,
    },
) {}
