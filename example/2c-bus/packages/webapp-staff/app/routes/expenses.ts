import type { Api } from "@expenses/contract/api";
import { useCases } from "@expenses/contract/registry";
import { failure, send } from "../http.js";

export const listMine = (bus: Api) =>
    send(bus.dispatch("expenses.ListMyExpenses", {}));

/** The client may validate with the use case.s schema to answer early; the bus validates anyway. */
export function create(bus: Api, body: unknown) {
    const input = useCases["expenses.CreateExpense"].input.safeParse(body);
    if (!input.success) return failure({ _tag: "InvalidInput" });
    return send(bus.dispatch("expenses.CreateExpense", input.data), 201);
}

export const submit = (bus: Api, expense_id: string) =>
    send(bus.dispatch("expenses.SubmitExpense", { expense_id }));
