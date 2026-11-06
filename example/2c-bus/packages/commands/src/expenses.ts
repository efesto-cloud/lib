import {
    ExpenseDto,
    ExpenseNotFound,
    ImportRowInvalid,
    InvalidAmount,
    InvalidFile,
    InvalidTransition,
} from "@expenses/core/client";
import { z } from "zod";
import { command } from "./command.js";

const ById = z.object({ expense_id: z.string() });
const Transition = [ExpenseNotFound, InvalidTransition] as const;

export const listMyExpenses = command({
    kind: "query",
    description: "Le note spese dell'attore",
    input: z.object({}),
    output: z.array(ExpenseDto),
    errors: [],
});

export const listSubmittedExpenses = command({
    kind: "query",
    description: "Le note spese inviate, in attesa di revisione",
    input: z.object({}),
    output: z.array(ExpenseDto),
    errors: [],
});

export const createExpense = command({
    kind: "mutation",
    description: "Crea una nota spese in bozza; l'autore è l'attore",
    input: z.object({
        description: z.string(),
        amount_cents: z.number(),
    }),
    output: ExpenseDto,
    errors: [InvalidAmount],
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
    input: z.object({ file: z.string() }),
    output: z.object({ created: z.number() }),
    errors: [InvalidFile, ImportRowInvalid],
});
