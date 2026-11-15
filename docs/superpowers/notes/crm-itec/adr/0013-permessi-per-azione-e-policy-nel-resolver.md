---
status: accepted
---

# I permessi per azione, con una policy per use case applicata dal resolver

Nell'HTML di LZ i permessi sono una matrice ruolo × fase → livello (nessuno,
Visualizza, Modifica, Autorizza fase succ.), e il codice traduce il livello in
azioni, sparso nei pulsanti: «Autorizza» su In approvazione vuol dire
autorizzare l'offerta, su Accettata convertire. Il legame fra livello e
azione sta solo nella testa di chi legge il codice. Il nostro CRM, fino a #93, controllava
soltanto che l'utente ci fosse e che le Impostazioni le aprisse
l'Amministratore, nella rotta.

La decisione ha due parti.

**Ruolo × azione → sì/no.** I ruoli sono fissi nel codice (BP, OP, PM/BO,
Ingegneria) e l'Amministratore è un flag. Ogni passaggio di stato è
un'azione, e la fase in cui è ammesso è dominio, nello use case, uguale per
tutti. Modificare la commessa è un'azione per fase, perché LZ la differenzia
per ruolo; modificare l'offerta un'azione sola. Tornare indietro è la stessa
azione del passaggio che annulla; creare si controlla sulla BU dell'input. La
matrice sta nel database e la cambia l'Amministratore; il catalogo delle
azioni sta nel contract. Si guarda sempre una cella sola.

**Una policy per use case, applicata dal resolver.** Ogni use case ha una
policy, in un file solo (`packages/core/src/auth/policies.ts`), e uno use
case senza policy non compila. La policy è una classe `@injectable()` che
estende `Policy`, con `check(target, ctx)`; si fa iniettare le repository che
le servono, e `static on(select)` ne fa la versione per un input preciso
(`.on((i) => i.codice)`), così da dove si prende l'id è scritto accanto allo
use case. Per ogni use case `useCaseModule` lega, accanto alla chiave, un
oggetto che si fa iniettare lo use case e la sua policy, ed è quello che dà il
resolver; il tipo del resolver aggiunge `NotAllowedError` agli errori di ogni
use case. Il resolver resta uno per Worker, e la policy guarda il `ctx` di
ogni chiamata.

Policy e use case si risolvono **nella stessa risoluzione**, cioè nello
stesso request scope di Inversify: le repository della policy vedono la
stessa Unit of Work dello use case (ADR 0011). Due `container.get` separati
darebbero alla policy una Unit of Work sua, che legge un'altra fotografia del
database.

## Le alternative scartate

- **Ruolo × fase → livello, com'è nell'HTML.** Il livello va interpretato, e
  l'interpretazione finisce di nuovo sparsa nel codice.
- **Il controllo nelle rotte.** Ogni rotta dovrebbe ricordarselo, e la sonda
  o un'altra rotta che chiama lo stesso use case lo salterebbe.
- **`onActivation` di Inversify.** Avvolgerebbe anche gli use case che un
  altro use case si fa iniettare, e il controllo non si vedrebbe da nessuna
  parte nel codice dello use case né del resolver.
- **Una mappa di funzioni al posto delle classi.** Le policy delle pratiche
  devono caricare la pratica, quindi vogliono le repository: una classe
  iniettabile le riceve come lo use case.

## Le conseguenze che vale la pena conoscere

- **Gli use case che un altro use case si fa iniettare non passano dalla
  policy**: si controlla chi chiama da fuori. Sotto la chiave del registro il
  container tiene lo use case nudo; dietro la policy lo dà solo il resolver.
  Oggi non ce ne sono.
- **Una pratica che non esiste la segnala lo use case**: la policy lascia
  passare, e lo use case risponde col suo `NotFoundError`.
- **L'autenticazione è del bordo.** Gli use case della sonda, del login e
  della rilettura dell'utente hanno `Anyone`: li protegge la firma HMAC o il
  token già verificato (ADR 0012). Una rotta che li chiamasse senza
  autenticare romperebbe il patto.
- **`AnyUtente` vuol dire solo «c'è un utente».** Il cambio password
  obbligatorio resta compito del guscio, e il middleware di Impostazioni resta
  per la navigazione: il permesso vero lo dà `OnlyAmministratore`.
- **I test che passano dal resolver vogliono un utente** con i permessi che
  presuppongono, come le chiamate vere.
- **Ogni permesso cambiato si vede nel diff**: la mappa use case → policy ha
  uno snapshot versionato (`packages/core/src/auth/test/policies.snap.txt`).

Contesto: la mappa #93, decisioni dell'11 e del 12 novembre 2026, con Dario;
il riepilogo con le figure è `docs/permessi/index.html`. Dove sta la regola
della casella, cioè in `Pratica.ruoliDi` e `Matrice.consente` e non in un
servizio, lo dice l'ADR 0014.
