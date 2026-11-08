import { ExpenseDto } from "../../dto/ExpenseDto.js";
import ExpenseNotFound from "../../errors/ExpenseNotFound.js";
import InvalidTransition from "../../errors/InvalidTransition.js";
import { type InputOf, type UseCaseOf, useCase } from "../../useCase.js";
import { ById } from "./inputs.js";

export const ReimburseExpense = useCase({
    kind: "mutation",
    description: "Segna come rimborsata una nota spese approvata",
    input: ById,
    output: ExpenseDto,
    errors: [ExpenseNotFound, InvalidTransition],
});

export interface IReimburseExpense extends UseCaseOf<typeof ReimburseExpense> {}

export namespace IReimburseExpense {
    export type Input = InputOf<typeof ReimburseExpense>;
}
