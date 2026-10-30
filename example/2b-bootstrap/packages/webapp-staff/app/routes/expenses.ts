import { Result, Schema } from "effect";
import { failure } from "../http.js";
import { type RouteContext, run } from "./run.js";

const NewExpense = Schema.Struct({
    description: Schema.String,
    amount_cents: Schema.Number,
});

export const listMine = (ctx: RouteContext) =>
    run(ctx, "expenses.ListMyExpenses", {});

/** The route checks the shape; the use case trusts it. */
export function create(ctx: RouteContext, body: unknown) {
    const input = Schema.decodeUnknownResult(NewExpense)(body);
    if (Result.isFailure(input)) return failure({ _tag: "InvalidInput" });
    return run(ctx, "expenses.CreateExpense", input.success, 201);
}

export const submit = (ctx: RouteContext, expense_id: string) =>
    run(ctx, "expenses.SubmitExpense", { expense_id });
