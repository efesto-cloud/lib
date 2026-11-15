import { inject, injectable } from "inversify";
import PraticaPolicy from "~/auth/policy/PraticaPolicy.js";
import InternalSymbols from "~/di/InternalSymbols.js";
import type Offerta from "~/entity/Offerta.js";
import type IOffertaRepository from "~/repo/IOffertaRepository.js";
import type IPermessoRepository from "~/repo/IPermessoRepository.js";

/** Un'azione sull'offerta di codice dato. */
@injectable()
export default abstract class OffertaPolicy extends PraticaPolicy<Offerta> {
    protected readonly crea = "offerta.crea";

    constructor(
        @inject(InternalSymbols.Repo.Offerta)
        private readonly offerte: IOffertaRepository,
        @inject(InternalSymbols.Repo.Permesso) permessi: IPermessoRepository,
    ) {
        super(permessi);
    }

    protected findByCodice(codice: string) {
        return this.offerte.findByCodice(codice);
    }
}
