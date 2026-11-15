import { ContainerModule } from "inversify";
import InternalSymbols from "~/di/InternalSymbols.js";

/**
 * Le variabili d'ambiente che il core usa, lette qui e da nessun'altra parte.
 * `SOGLIA_AUTORIZZAZIONE` è la soglia di autorizzazione dell'offerta, in euro.
 */
export function installConfig(env: {
    SOGLIA_AUTORIZZAZIONE?: string;
}): ContainerModule {
    const soglia = Number(env.SOGLIA_AUTORIZZAZIONE);
    if (!env.SOGLIA_AUTORIZZAZIONE || !(soglia >= 0))
        throw new Error(
            `SOGLIA_AUTORIZZAZIONE dev'essere un importo in euro, non «${env.SOGLIA_AUTORIZZAZIONE}»`,
        );
    return new ContainerModule((bind) => {
        bind(InternalSymbols.Config.SogliaAutorizzazione).toConstantValue(
            soglia,
        );
    });
}
