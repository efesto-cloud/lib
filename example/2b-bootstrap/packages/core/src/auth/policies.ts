import type { UseCaseInput, UseCaseKey } from "../di/UseCaseRegistry.js";
import {
    anyMember,
    authorOfExpense,
    can,
    internal,
    type Policy,
} from "./policy.js";

/**
 * The policy of every use case. A use case without one does not compile,
 * because the type requires every key of the registry.
 */
export const policies: { [K in UseCaseKey]: Policy<UseCaseInput<K>> } = {
    "expenses.CreateExpense": can("expenses.create"),
    "expenses.SubmitExpense": authorOfExpense,
    "expenses.ApproveExpense": can("expenses.review"),
    "expenses.RejectExpense": can("expenses.review"),
    "expenses.ReimburseExpense": can("expenses.reimburse"),
    "expenses.ListMyExpenses": anyMember,
    "expenses.ListSubmittedExpenses": can("expenses.review"),
    "expenses.ImportExpenses": can("expenses.import"),
    "expenses.NotifyAuthor": internal,
};
