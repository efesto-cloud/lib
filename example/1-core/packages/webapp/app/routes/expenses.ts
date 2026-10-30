import { Result, Schema } from "effect";
import { failure } from "../http.js";
import { type RouteContext, run } from "./run.js";

const NewExpense = Schema.Struct({
    description: Schema.String,
    amount_cents: Schema.Number,
});

export const listMine = (ctx: RouteContext) =>
    run(ctx, "expenses.ListMyExpenses", {});

export const listSubmitted = (ctx: RouteContext) =>
    run(ctx, "expenses.ListSubmittedExpenses", {});

/** The route checks the shape; the use case trusts it. */
export function create(ctx: RouteContext, body: unknown) {
    const input = Schema.decodeUnknownResult(NewExpense)(body);
    if (Result.isFailure(input)) return failure({ _tag: "InvalidInput" });
    return run(ctx, "expenses.CreateExpense", input.success, 201);
}

export const importFile = (ctx: RouteContext, file: string) =>
    run(ctx, "expenses.ImportExpenses", { file }, 201);

const ACTIONS = {
    submit: "expenses.SubmitExpense",
    approve: "expenses.ApproveExpense",
    reject: "expenses.RejectExpense",
    reimburse: "expenses.ReimburseExpense",
} as const;

export function transition(
    ctx: RouteContext,
    expense_id: string,
    action: keyof typeof ACTIONS,
) {
    return run(ctx, ACTIONS[action], { expense_id });
}
