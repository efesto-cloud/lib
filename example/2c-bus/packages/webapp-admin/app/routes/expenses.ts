import type { Api } from "@expenses/contract/api";
import { send } from "../http.js";

export const listSubmitted = (bus: Api) =>
    send(bus.dispatch("expenses.ListSubmittedExpenses", {}));

export const importFile = (bus: Api, file: string) =>
    send(bus.dispatch("expenses.ImportExpenses", { file }), 201);

const USE_CASES = {
    approve: "expenses.ApproveExpense",
    reject: "expenses.RejectExpense",
    reimburse: "expenses.ReimburseExpense",
} as const;

export function review(
    bus: Api,
    expense_id: string,
    action: keyof typeof USE_CASES,
) {
    return send(bus.dispatch(USE_CASES[action], { expense_id }));
}
