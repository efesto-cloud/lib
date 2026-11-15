import type { Result } from "better-result";
import type NotAllowedError from "~/errors/NotAllowedError.js";
import type AccessoUseCases from "~/useCase/accesso/AccessoUseCases.js";
import type ArcaUseCases from "~/useCase/arca/ArcaUseCases.js";
import type ClientiUseCases from "~/useCase/clienti/ClientiUseCases.js";
import type CommesseUseCases from "~/useCase/commesse/CommesseUseCases.js";
import type CostiUseCases from "~/useCase/costi/CostiUseCases.js";
import type FornitoriUseCases from "~/useCase/fornitori/FornitoriUseCases.js";
import type OfferteUseCases from "~/useCase/offerte/OfferteUseCases.js";
import type PermessiUseCases from "~/useCase/permessi/PermessiUseCases.js";
import type UtentiUseCases from "~/useCase/utenti/UtentiUseCases.js";
import type { UseCase } from "~/useCase.js";

/**
 * Tutti gli use case, per chiave, un modulo per riga. La chiave è anche
 * l'identificativo nel container del core.
 */
export type UseCaseRegistry = AccessoUseCases &
    ArcaUseCases &
    ClientiUseCases &
    CommesseUseCases &
    CostiUseCases &
    FornitoriUseCases &
    OfferteUseCases &
    PermessiUseCases &
    UtentiUseCases;

/** Lo use case dietro la sua policy, che può rispondere `NotAllowedError`. */
export type Guarded<U> =
    U extends UseCase<infer I, Result<infer T, infer E>>
        ? UseCase<I, Result<T, E | NotAllowedError>>
        : never;

/**
 * `resolveUseCase("arca.SyncArcaToCloud")` dà lo use case col suo tipo, già
 * dietro la sua policy.
 */
export type UseCaseResolver = <K extends keyof UseCaseRegistry>(
    key: K,
) => Guarded<UseCaseRegistry[K]>;
