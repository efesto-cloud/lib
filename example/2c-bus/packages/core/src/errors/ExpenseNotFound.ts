import { z } from "zod";
import { taggedError } from "./taggedError.js";

export default class ExpenseNotFound extends taggedError("ExpenseNotFound", {
    expense_id: z.string(),
}) {}
