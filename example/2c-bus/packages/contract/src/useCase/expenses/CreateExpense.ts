import { z } from "zod";
import { ExpenseDto } from "../../dto/ExpenseDto.js";
import InvalidAmount from "../../errors/InvalidAmount.js";
import { type InputOf, type UseCaseOf, useCase } from "../../useCase.js";

export const CreateExpense = useCase({
    kind: "mutation",
    description: "Crea una nota spese in bozza; l'autore è l'attore",
    input: z.object({ description: z.string(), amount_cents: z.number() }),
    output: ExpenseDto,
    errors: [InvalidAmount],
});

export interface ICreateExpense extends UseCaseOf<typeof CreateExpense> {}

export namespace ICreateExpense {
    export type Input = InputOf<typeof CreateExpense>;
}
