import {
    ExpenseDto,
    ExpenseNotFound,
    ImportRowInvalid,
    InvalidAmount,
    InvalidFile,
    InvalidTransition,
} from "@expenses/core/client";
import { Schema } from "effect";
import { command } from "./command.js";

const ById = Schema.Struct({ expense_id: Schema.String });
const Transition = Schema.Union([ExpenseNotFound, InvalidTransition]);

export const listMyExpenses = command({
    kind: "query",
    description: "Le note spese dell'attore",
    input: Schema.Struct({}),
    output: Schema.Array(ExpenseDto),
    errors: Schema.Never,
});

export const listSubmittedExpenses = command({
    kind: "query",
    description: "Le note spese inviate, in attesa di revisione",
    input: Schema.Struct({}),
    output: Schema.Array(ExpenseDto),
    errors: Schema.Never,
});

export const createExpense = command({
    kind: "mutation",
    description: "Crea una nota spese in bozza; l'autore è l'attore",
    input: Schema.Struct({
        description: Schema.String,
        amount_cents: Schema.Number,
    }),
    output: ExpenseDto,
    errors: InvalidAmount,
});

export const submitExpense = command({
    kind: "mutation",
    description: "Invia una propria nota spese in bozza",
    input: ById,
    output: ExpenseDto,
    errors: Transition,
});

export const approveExpense = command({
    kind: "mutation",
    description: "Approva una nota spese inviata e avvisa l'autore",
    input: ById,
    output: ExpenseDto,
    errors: Transition,
});

export const rejectExpense = command({
    kind: "mutation",
    description: "Respinge una nota spese inviata",
    input: ById,
    output: ExpenseDto,
    errors: Transition,
});

export const reimburseExpense = command({
    kind: "mutation",
    description: "Segna come rimborsata una nota spese approvata",
    input: ById,
    output: ExpenseDto,
    errors: Transition,
});

export const importExpenses = command({
    kind: "mutation",
    description: "Importa note spese da un file: tutte o nessuna",
    input: Schema.Struct({ file: Schema.String }),
    output: Schema.Struct({ created: Schema.Number }),
    errors: Schema.Union([InvalidFile, ImportRowInvalid]),
});
