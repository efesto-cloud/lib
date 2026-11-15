import type { Result } from "better-result";
import { z } from "zod";
import type ClienteWithoutNomeError from "~/errors/ClienteWithoutNomeError.js";
import type CodiceClienteTakenError from "~/errors/CodiceClienteTakenError.js";
import type ConflictError from "~/errors/ConflictError.js";
import type InvalidCodiceClienteError from "~/errors/InvalidCodiceClienteError.js";
import type RagioneSocialeNotFoundError from "~/errors/RagioneSocialeNotFoundError.js";
import type ICliente from "~/interface/ICliente.js";
import type { UseCase } from "~/useCase.js";

/**
 * Senza `codice`, lo propone dal nome, libero. Con `codice_arca`, il cliente
 * nasce con quella ragione sociale, tolta a chi l'aveva.
 */
export const CreateClienteInput = z.object({
    nome: z.string(),
    codice: z.string().nullable(),
    codice_arca: z.string().nullable(),
});

export type CreateClienteInput = z.infer<typeof CreateClienteInput>;

export default interface ICreateCliente
    extends UseCase<
        CreateClienteInput,
        Result<
            ICliente,
            | ClienteWithoutNomeError
            | CodiceClienteTakenError
            | ConflictError
            | InvalidCodiceClienteError
            | RagioneSocialeNotFoundError
        >
    > {}
