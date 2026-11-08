import { ExpenseDto } from "../../dto/ExpenseDto.js";
import ExpenseNotFound from "../../errors/ExpenseNotFound.js";
import InvalidTransition from "../../errors/InvalidTransition.js";
import { type InputOf, type UseCaseOf, useCase } from "../../useCase.js";
import { ById } from "./inputs.js";

export const RejectExpense = useCase({
    kind: "mutation",
    description: "Respinge una nota spese inviata",
    input: ById,
    output: ExpenseDto,
    errors: [ExpenseNotFound, InvalidTransition],
});

export interface IRejectExpense extends UseCaseOf<typeof RejectExpense> {}

export namespace IRejectExpense {
    export type Input = InputOf<typeof RejectExpense>;
}
