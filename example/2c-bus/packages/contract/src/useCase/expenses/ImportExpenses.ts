import { z } from "zod";
import ImportRowInvalid from "../../errors/ImportRowInvalid.js";
import InvalidFile from "../../errors/InvalidFile.js";
import {
    type ErrorOf,
    type InputOf,
    type UseCaseOf,
    useCase,
} from "../../useCase.js";

export const ImportExpenses = useCase({
    kind: "mutation",
    description: "Importa note spese da un file: tutte o nessuna",
    input: z.object({ file: z.string() }),
    output: z.object({ created: z.number() }),
    errors: [InvalidFile, ImportRowInvalid],
});

export interface IImportExpenses extends UseCaseOf<typeof ImportExpenses> {}

export namespace IImportExpenses {
    export type Input = InputOf<typeof ImportExpenses>;
    export type Error = ErrorOf<typeof ImportExpenses>;
}
