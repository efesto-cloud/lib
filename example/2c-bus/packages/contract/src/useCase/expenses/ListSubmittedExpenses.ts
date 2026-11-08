import { z } from "zod";
import { ExpenseDto } from "../../dto/ExpenseDto.js";
import { type InputOf, type UseCaseOf, useCase } from "../../useCase.js";

export const ListSubmittedExpenses = useCase({
    kind: "query",
    description: "Le note spese inviate, in attesa di revisione",
    input: z.object({}),
    output: z.array(ExpenseDto),
    errors: [],
});

export interface IListSubmittedExpenses
    extends UseCaseOf<typeof ListSubmittedExpenses> {}

export namespace IListSubmittedExpenses {
    export type Input = InputOf<typeof ListSubmittedExpenses>;
}
