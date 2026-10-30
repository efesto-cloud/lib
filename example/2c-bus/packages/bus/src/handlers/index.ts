import type { CommandName } from "@expenses/commands";
import { type Handler, handler } from "../handler.js";

const byId = (input: { expense_id: string }) => ({
    expense_id: input.expense_id,
});

/** One handler per command: a command without a handler does not compile. */
export const handlers: { [K in CommandName]: Handler<K> } = {
    listMyExpenses: handler("listMyExpenses", {
        useCase: "expenses.ListMyExpenses",
        toUseCase: () => ({}),
    }),
    listSubmittedExpenses: handler("listSubmittedExpenses", {
        useCase: "expenses.ListSubmittedExpenses",
        toUseCase: () => ({}),
    }),
    createExpense: handler("createExpense", {
        useCase: "expenses.CreateExpense",
        toUseCase: (input) => input,
    }),
    submitExpense: handler("submitExpense", {
        useCase: "expenses.SubmitExpense",
        toUseCase: byId,
    }),
    approveExpense: handler("approveExpense", {
        useCase: "expenses.ApproveExpense",
        toUseCase: byId,
    }),
    rejectExpense: handler("rejectExpense", {
        useCase: "expenses.RejectExpense",
        toUseCase: byId,
    }),
    reimburseExpense: handler("reimburseExpense", {
        useCase: "expenses.ReimburseExpense",
        toUseCase: byId,
    }),
    importExpenses: handler("importExpenses", {
        useCase: "expenses.ImportExpenses",
        toUseCase: (input) => input,
    }),
};
