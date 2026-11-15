import type ConflictError from "@itec/contract/errors/ConflictError";
import type { Err, Result } from "better-result";

/**
 * La Unit of Work di un'esecuzione di use case (docs/adr/0011). Dentro
 * `work` i `save` delle repository accodano, non scrivono, e le letture non
 * vedono la coda; alla fine la coda si scrive tutta o niente, anche se `work`
 * restituisce un errore, e si butta solo se `work` lancia. Se qualcuno ha
 * scritto le stesse righe nel frattempo, `work` si ripete da capo, un numero
 * fisso di volte, poi resta `ConflictError`.
 */
export default interface IUnitOfWork {
    runWithTransaction<R extends Result<unknown, unknown>>(
        work: () => Promise<R>,
    ): Promise<R | Err<never, ConflictError>>;
}
