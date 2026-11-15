import type { UseCaseRegistry } from "@itec/contract/registry";
import Anyone from "~/auth/policy/Anyone.js";
import AnyUtente from "~/auth/policy/AnyUtente.js";
import CanAccettaOfferta from "~/auth/policy/CanAccettaOfferta.js";
import CanArchiviaCommessa from "~/auth/policy/CanArchiviaCommessa.js";
import CanArchiviaOfferta from "~/auth/policy/CanArchiviaOfferta.js";
import CanAutorizzaOfferta from "~/auth/policy/CanAutorizzaOfferta.js";
import CanConvertiOfferta from "~/auth/policy/CanConvertiOfferta.js";
import CanCreaCommessa from "~/auth/policy/CanCreaCommessa.js";
import CanCreaOfferta from "~/auth/policy/CanCreaOfferta.js";
import CanCreaOffertaExtra from "~/auth/policy/CanCreaOffertaExtra.js";
import CanModificaCommessa from "~/auth/policy/CanModificaCommessa.js";
import CanModificaOfferta from "~/auth/policy/CanModificaOfferta.js";
import CanPassaCommessa from "~/auth/policy/CanPassaCommessa.js";
import CanPassaOfferta from "~/auth/policy/CanPassaOfferta.js";
import CanRipristinaCommessa from "~/auth/policy/CanRipristinaCommessa.js";
import CanRipristinaOfferta from "~/auth/policy/CanRipristinaOfferta.js";
import CanTornaCommessa from "~/auth/policy/CanTornaCommessa.js";
import CanTornaOfferta from "~/auth/policy/CanTornaOfferta.js";
import CanVediCommessa from "~/auth/policy/CanVediCommessa.js";
import CanVediOfferta from "~/auth/policy/CanVediOfferta.js";
import OnlyAmministratore from "~/auth/policy/OnlyAmministratore.js";
import type { Policies } from "~/di/useCaseModule.js";

/**
 * Chi può eseguire ogni use case (docs/adr/0013): se ne manca uno, non
 * compila. Ogni cambio si vede in `test/policies.snap.txt`.
 */
const policies: Policies<UseCaseRegistry> = {
    // Prima del login, o col token già verificato da `autentica`.
    "accesso.GetUtente": Anyone,
    "accesso.Login": Anyone,
    "accesso.SeedUtenti": Anyone,
    "accesso.ChangePassword": AnyUtente,

    // Li autentica il bordo, con la firma HMAC sulle route /api/sonda/*: una
    // route della webapp che li chiamasse senza utente romperebbe il patto.
    "arca.RecordHeartbeat": Anyone,
    "arca.RecordSyncFailure": Anyone,
    "arca.SendHeartbeat": Anyone,
    "arca.StoreSyncBlock": Anyone,
    "arca.SyncArcaToCloud": Anyone,
    "arca.GetProbeStatus": OnlyAmministratore,
    // Di tutte le commesse: le riconcilia chi gestisce anagrafiche e Impostazioni.
    "arca.ListAvvisi": OnlyAmministratore,

    // Il cliente si crea al volo dalla nuova offerta.
    "clienti.CreateCliente": AnyUtente,
    "clienti.ListClienti": AnyUtente,
    "clienti.ListRagioniSociali": AnyUtente,
    "clienti.AssignRagioneSociale": OnlyAmministratore,
    "clienti.RenameCliente": OnlyAmministratore,

    // Le pratiche: un'azione della matrice, con la portata (docs/adr/0013).
    "commesse.AddSottocommessa": CanModificaCommessa.on(
        (i) => i.codice_commessa,
    ),
    "commesse.ArchiviaCommessa": CanArchiviaCommessa.on((i) => i.codice),
    "commesse.ConvertiOfferta": CanConvertiOfferta.on((i) => i.codice),
    "commesse.CreateCommessa": CanCreaCommessa.on((i) => ({
        bu: i.bu,
        squadra: [i.pm_id],
    })),
    "commesse.DeleteSottocommessa": CanModificaCommessa.on(
        (i) => i.codice_commessa,
    ),
    "commesse.GetCommessa": CanVediCommessa.on((i) => i.codice),
    "commesse.GetConsuntivoCommessa": CanVediCommessa.on((i) => i.codice),
    "commesse.GetPercorsoCommessa": CanVediCommessa.on((i) => i.codice),
    "commesse.GetTerminiIncasso": CanVediCommessa.on((i) => i.codice),
    "commesse.ListBuDoveSpostareCommessa": CanVediCommessa.on((i) => i.codice),
    "commesse.PassaCommessa": CanPassaCommessa.on((i) => i.codice),
    "commesse.RipristinaCommessa": CanRipristinaCommessa.on((i) => i.codice),
    "commesse.TornaCommessa": CanTornaCommessa.on((i) => i.codice),
    "commesse.UpdateBudgetCommessa": CanModificaCommessa.on((i) => i.codice),
    "commesse.UpdateChecklistCommessa": CanModificaCommessa.on((i) => i.codice),
    // Tutto l'input: se porta la pratica su un'altra BU, chiede anche `crea` lì.
    "commesse.UpdateCommessa": CanModificaCommessa,
    "commesse.UpdateDocumentiCommessa": CanModificaCommessa.on((i) => i.codice),
    "commesse.UpdateLogisticaCommessa": CanModificaCommessa.on((i) => i.codice),
    "commesse.UpdateMilestoneCommessa": CanModificaCommessa.on((i) => i.codice),
    "commesse.UpdateSollecitiCommessa": CanModificaCommessa.on((i) => i.codice),
    "commesse.UpdateSottocommessa": CanModificaCommessa.on(
        (i) => i.codice_commessa,
    ),
    "commesse.UpdateSquadraCommessa": CanModificaCommessa.on((i) => i.codice),

    // Il fornitore non ancora in Arca si crea al volo dagli acquisti strategici.
    "fornitori.CreateFornitore": AnyUtente,
    "fornitori.ListFornitori": AnyUtente,

    // Come i clienti e le ragioni sociali, fra cui si sceglie.
    "offerte.ListOfferteArca": AnyUtente,

    "offerte.AccettaOfferta": CanAccettaOfferta.on((i) => i.codice),
    "offerte.ArchiviaOfferta": CanArchiviaOfferta.on((i) => i.codice),
    "offerte.AutorizzaOfferta": CanAutorizzaOfferta.on((i) => i.codice),
    "offerte.CreateOfferta": CanCreaOfferta.on((i) => ({
        bu: i.bu,
        squadra: [i.bp_id, i.pm_id],
    })),
    "offerte.CreateOffertaExtra": CanCreaOffertaExtra.on((i) => ({
        codice_commessa: i.codice_commessa,
        squadra: [i.bp_id, i.pm_id],
    })),
    "offerte.GetOfferta": CanVediOfferta.on((i) => i.codice),
    "offerte.GetPercorsoOfferta": CanVediOfferta.on((i) => i.codice),
    "offerte.ListBuDoveSpostareOfferta": CanVediOfferta.on((i) => i.codice),
    "offerte.PassaOfferta": CanPassaOfferta.on((i) => i.codice),
    "offerte.RipristinaOfferta": CanRipristinaOfferta.on((i) => i.codice),
    "offerte.TornaOfferta": CanTornaOfferta.on((i) => i.codice),
    "offerte.UpdateBudgetOfferta": CanModificaOfferta.on((i) => i.codice),
    // Come `commesse.UpdateCommessa`.
    "offerte.UpdateOfferta": CanModificaOfferta,

    // Filtrano per `vedi` nella query: ognuno vede le sue.
    "commesse.GetFinancials": AnyUtente,
    "commesse.ListCommesse": AnyUtente,
    "offerte.ListOfferte": AnyUtente,

    "costi.ClassificaConto": OnlyAmministratore,
    "costi.ListContiDiCosto": OnlyAmministratore,

    "permessi.GetPermessi": OnlyAmministratore,
    // Di chi chiama: per proporgli solo le BU su cui può agire.
    "permessi.ListBuConsentite": AnyUtente,
    "permessi.UpdatePermessi": OnlyAmministratore,

    // Le pagine delle pratiche la usano per scegliere la squadra.
    "utenti.ListUtenti": AnyUtente,
    "utenti.CreateUtente": OnlyAmministratore,
    "utenti.DeleteUtente": OnlyAmministratore,
    "utenti.ResetPassword": OnlyAmministratore,
    "utenti.UpdateUtente": OnlyAmministratore,
};

export default policies;
