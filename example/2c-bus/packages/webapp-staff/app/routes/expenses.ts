import { type Bus, commands } from "@expenses/commands";
import { Result, Schema } from "effect";
import { failure, send } from "../http.js";

export const listMine = (bus: Bus) => send(bus.dispatch("listMyExpenses", {}));

/** The client may validate with the command's schema to answer early; the bus validates anyway. */
export function create(bus: Bus, body: unknown) {
    const input = Schema.decodeUnknownResult(commands.createExpense.input)(
        body,
    );
    if (Result.isFailure(input)) return failure({ _tag: "InvalidInput" });
    return send(bus.dispatch("createExpense", input.success), 201);
}

export const submit = (bus: Bus, expense_id: string) =>
    send(bus.dispatch("submitExpense", { expense_id }));
