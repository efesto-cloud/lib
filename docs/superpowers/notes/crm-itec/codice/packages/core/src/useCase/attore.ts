import type IUtente from "@itec/contract/interface/IUtente";
import type { ExecutionContext } from "@itec/contract/useCase";

/**
 * Chi agisce, dal contesto. Senza utente è un errore di programmazione, non
 * un caso del dominio: chi chiama uno use case così deve passarlo.
 */
export function attore({ utente }: ExecutionContext): IUtente {
    if (!utente) throw new Error("Use case chiamato senza utente nel contesto");
    return utente;
}
