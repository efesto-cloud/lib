import { ExpenseDto } from "../../dto/ExpenseDto.js";
import ExpenseNotFound from "../../errors/ExpenseNotFound.js";
import InvalidTransition from "../../errors/InvalidTransition.js";
import { type InputOf, type UseCaseOf, useCase } from "../../useCase.js";
import { ById } from "./inputs.js";

export const SubmitExpense = useCase({
    kind: "mutation",
    description: "Invia una propria nota spese in bozza",
    input: ById,
    output: ExpenseDto,
    errors: [ExpenseNotFound, InvalidTransition],
});

export interface ISubmitExpense extends UseCaseOf<typeof SubmitExpense> {}

export namespace ISubmitExpense {
    export type Input = InputOf<typeof SubmitExpense>;
}
