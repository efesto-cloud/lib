import { z } from "zod";
import { EXPENSE_STATUSES } from "../type/ExpenseStatus.js";
import { taggedError } from "./taggedError.js";

const Status = z.enum(EXPENSE_STATUSES);

export default class InvalidTransition extends taggedError(
    "InvalidTransition",
    {
        expense_id: z.string(),
        from: Status,
        to: Status,
    },
) {}
