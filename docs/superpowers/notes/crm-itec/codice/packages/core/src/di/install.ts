import type { UseCaseRegistry } from "@itec/contract/registry";
import type { Container } from "inversify";
import policies from "~/auth/policies.js";
import { useCaseModule } from "~/di/useCaseModule.js";
import AccessoModule from "~/useCase/accesso/AccessoModule.js";
import ArcaModule from "~/useCase/arca/ArcaModule.js";
import ClientiModule from "~/useCase/clienti/ClientiModule.js";
import CommesseModule from "~/useCase/commesse/CommesseModule.js";
import CostiModule from "~/useCase/costi/CostiModule.js";
import FornitoriModule from "~/useCase/fornitori/FornitoriModule.js";
import OfferteModule from "~/useCase/offerte/OfferteModule.js";
import PermessiModule from "~/useCase/permessi/PermessiModule.js";
import UtentiModule from "~/useCase/utenti/UtentiModule.js";

/**
 * Carica gli use case del core, e i servizi che le policy si fanno
 * iniettare, sul container della composition root. Gli adattatori li lega
 * lei: il core non può importarli.
 */
export function install(container: Container): void {
    container.load(
        useCaseModule<UseCaseRegistry>(
            {
                ...AccessoModule,
                ...ArcaModule,
                ...ClientiModule,
                ...CommesseModule,
                ...CostiModule,
                ...FornitoriModule,
                ...OfferteModule,
                ...PermessiModule,
                ...UtentiModule,
            },
            policies,
        ),
    );
}
