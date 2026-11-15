import InternalSymbols from "@itec/core/di/InternalSymbols";
import { ContainerModule } from "inversify";
import ArcaMirrorRepoImpl from "~/ArcaMirrorRepoImpl.js";
import ClienteRepoImpl from "~/ClienteRepoImpl.js";
import CommessaRepoImpl from "~/CommessaRepoImpl.js";
import D1UnitOfWork from "~/D1UnitOfWork.js";
import FornitoreRepoImpl from "~/FornitoreRepoImpl.js";
import NaturaCostoContoRepoImpl from "~/NaturaCostoContoRepoImpl.js";
import OffertaRepoImpl from "~/OffertaRepoImpl.js";
import PassaggioRepoImpl from "~/PassaggioRepoImpl.js";
import PermessoRepoImpl from "~/PermessoRepoImpl.js";
import ProbeStatusRepoImpl from "~/ProbeStatusRepoImpl.js";
import RagioneSocialeRepoImpl from "~/RagioneSocialeRepoImpl.js";
import SottocommessaArcaRepoImpl from "~/SottocommessaArcaRepoImpl.js";
import TentativiAccessoRepoImpl from "~/TentativiAccessoRepoImpl.js";
import UtenteRepoImpl from "~/UtenteRepoImpl.js";

/**
 * La Unit of Work e le repository, una per risoluzione (`container.get`,
 * cioè per esecuzione di use case): chi riceve la `uow` non può durare di più.
 */
export function installD1({ DB }: { DB: D1Database }): ContainerModule {
    return new ContainerModule((bind) => {
        bind(InternalSymbols.UnitOfWork)
            .toDynamicValue(() => new D1UnitOfWork(DB))
            .inRequestScope();
        bind(InternalSymbols.Repo.ArcaMirror).toConstantValue(
            new ArcaMirrorRepoImpl(DB),
        );
        bind(InternalSymbols.Repo.Cliente).to(ClienteRepoImpl).inRequestScope();
        bind(InternalSymbols.Repo.Commessa)
            .to(CommessaRepoImpl)
            .inRequestScope();
        bind(InternalSymbols.Repo.Fornitore)
            .to(FornitoreRepoImpl)
            .inRequestScope();
        bind(InternalSymbols.Repo.NaturaCostoConto)
            .to(NaturaCostoContoRepoImpl)
            .inRequestScope();
        bind(InternalSymbols.Repo.Offerta).to(OffertaRepoImpl).inRequestScope();
        bind(InternalSymbols.Repo.Passaggio)
            .to(PassaggioRepoImpl)
            .inRequestScope();
        bind(InternalSymbols.Repo.Permesso)
            .to(PermessoRepoImpl)
            .inRequestScope();
        bind(InternalSymbols.Repo.ProbeStatus)
            .to(ProbeStatusRepoImpl)
            .inRequestScope();
        bind(InternalSymbols.Repo.RagioneSociale)
            .to(RagioneSocialeRepoImpl)
            .inRequestScope();
        bind(InternalSymbols.Repo.SottocommessaArca).toConstantValue(
            new SottocommessaArcaRepoImpl(DB),
        );
        bind(InternalSymbols.Repo.TentativiAccesso)
            .to(TentativiAccessoRepoImpl)
            .inRequestScope();
        bind(InternalSymbols.Repo.Utente).to(UtenteRepoImpl).inRequestScope();
    });
}
