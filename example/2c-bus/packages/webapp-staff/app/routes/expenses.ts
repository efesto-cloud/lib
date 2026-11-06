import { type Bus, commands } from "@expenses/commands";
import { failure, send } from "../http.js";

export const listMine = (bus: Bus) => send(bus.dispatch("listMyExpenses", {}));

/** The client may validate with the command's schema to answer early; the bus validates anyway. */
export function create(bus: Bus, body: unknown) {
    const input = commands.createExpense.input.safeParse(body);
    if (!input.success) return failure({ _tag: "InvalidInput" });
    return send(bus.dispatch("createExpense", input.data), 201);
}

export const submit = (bus: Bus, expense_id: string) =>
    send(bus.dispatch("submitExpense", { expense_id }));
