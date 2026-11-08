import { ApproveExpense } from "./ApproveExpense.js";
import { CreateExpense } from "./CreateExpense.js";
import { ImportExpenses } from "./ImportExpenses.js";
import { ListMyExpenses } from "./ListMyExpenses.js";
import { ListSubmittedExpenses } from "./ListSubmittedExpenses.js";
import { NotifyAuthor } from "./NotifyAuthor.js";
import { ReimburseExpense } from "./ReimburseExpense.js";
import { RejectExpense } from "./RejectExpense.js";
import { SubmitExpense } from "./SubmitExpense.js";

/** The use cases of the expenses module, by key. */
export const expenses = {
    "expenses.CreateExpense": CreateExpense,
    "expenses.SubmitExpense": SubmitExpense,
    "expenses.ApproveExpense": ApproveExpense,
    "expenses.RejectExpense": RejectExpense,
    "expenses.ReimburseExpense": ReimburseExpense,
    "expenses.ListMyExpenses": ListMyExpenses,
    "expenses.ListSubmittedExpenses": ListSubmittedExpenses,
    "expenses.ImportExpenses": ImportExpenses,
    "expenses.NotifyAuthor": NotifyAuthor,
} as const;
