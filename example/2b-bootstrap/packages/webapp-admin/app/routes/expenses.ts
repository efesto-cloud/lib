import { type RouteContext, run } from "./run.js";

export const listSubmitted = (ctx: RouteContext) =>
    run(ctx, "expenses.ListSubmittedExpenses", {});

export const importFile = (ctx: RouteContext, file: string) =>
    run(ctx, "expenses.ImportExpenses", { file }, 201);

const ACTIONS = {
    approve: "expenses.ApproveExpense",
    reject: "expenses.RejectExpense",
    reimburse: "expenses.ReimburseExpense",
} as const;

export function review(
    ctx: RouteContext,
    expense_id: string,
    action: keyof typeof ACTIONS,
) {
    return run(ctx, ACTIONS[action], { expense_id });
}
