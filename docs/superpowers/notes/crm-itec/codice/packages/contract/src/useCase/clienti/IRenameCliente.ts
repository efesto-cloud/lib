import type { Result } from "better-result";
import { z } from "zod";
import type ClienteNotFoundError from "~/errors/ClienteNotFoundError.js";
import type ClienteWithoutNomeError from "~/errors/ClienteWithoutNomeError.js";
import type ConflictError from "~/errors/ConflictError.js";
import type { UseCase } from "~/useCase.js";

/** Il codice non cambia. */
export const RenameClienteInput = z.object({
    codice: z.string(),
    nome: z.string(),
});

export type RenameClienteInput = z.infer<typeof RenameClienteInput>;

export default interface IRenameCliente
    extends UseCase<
        RenameClienteInput,
        Result<
            void,
            ClienteNotFoundError | ClienteWithoutNomeError | ConflictError
        >
    > {}
