import { ExpenseDto } from "../../dto/ExpenseDto.js";
import ExpenseNotFound from "../../errors/ExpenseNotFound.js";
import InvalidTransition from "../../errors/InvalidTransition.js";
import { type InputOf, type UseCaseOf, useCase } from "../../useCase.js";
import { ById } from "./inputs.js";

export const ApproveExpense = useCase({
    kind: "mutation",
    description: "Approva una nota spese inviata e avvisa l'autore",
    input: ById,
    output: ExpenseDto,
    errors: [ExpenseNotFound, InvalidTransition],
});

export interface IApproveExpense extends UseCaseOf<typeof ApproveExpense> {}

export namespace IApproveExpense {
    export type Input = InputOf<typeof ApproveExpense>;
}
