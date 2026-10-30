import type { Bus } from "@expenses/commands";
import { send } from "../http.js";

export const listSubmitted = (bus: Bus) =>
    send(bus.dispatch("listSubmittedExpenses", {}));

export const importFile = (bus: Bus, file: string) =>
    send(bus.dispatch("importExpenses", { file }), 201);

const COMMANDS = {
    approve: "approveExpense",
    reject: "rejectExpense",
    reimburse: "reimburseExpense",
} as const;

export function review(
    bus: Bus,
    expense_id: string,
    action: keyof typeof COMMANDS,
) {
    return send(bus.dispatch(COMMANDS[action], { expense_id }));
}
