import { z } from "zod";
import ExpenseNotFound from "../../errors/ExpenseNotFound.js";
import { type InputOf, type UseCaseOf, useCase } from "../../useCase.js";
import { ById } from "./inputs.js";

export const NotifyAuthor = useCase({
    kind: "mutation",
    description: "Avvisa l'autore che la sua nota spese è stata approvata",
    input: ById,
    output: z.void(),
    errors: [ExpenseNotFound],
});

export interface INotifyAuthor extends UseCaseOf<typeof NotifyAuthor> {}

export namespace INotifyAuthor {
    export type Input = InputOf<typeof NotifyAuthor>;
}
