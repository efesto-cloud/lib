import { z } from "zod";
import { ExpenseDto } from "../../dto/ExpenseDto.js";
import { type InputOf, type UseCaseOf, useCase } from "../../useCase.js";

export const ListMyExpenses = useCase({
    kind: "query",
    description: "Le note spese dell'attore",
    input: z.object({}),
    output: z.array(ExpenseDto),
    errors: [],
});

export interface IListMyExpenses extends UseCaseOf<typeof ListMyExpenses> {}

export namespace IListMyExpenses {
    export type Input = InputOf<typeof ListMyExpenses>;
}
