import { Schema } from "effect";
import { EXPENSE_STATUSES } from "../type/ExpenseStatus.js";

const Status = Schema.Literals(EXPENSE_STATUSES);

export default class InvalidTransition extends Schema.TaggedError<InvalidTransition>()(
    "InvalidTransition",
    {
        expense_id: Schema.String,
        from: Status,
        to: Status,
    },
) {}
