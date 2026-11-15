# @itec/core

Il dominio del CRM (vedi `docs/adr/0005`): offerte, commesse e sottocommesse,
clienti di gruppo, utenti, ruoli e business unit, e le regole di avanzamento
tra le fasi. Segue l'architettura esagonale delle altre repo Thera (vedi
`docs/adr/0002`) nella forma di `docs/adr/0009`: quello che vedono i chiamanti
sta in `@itec/contract`, qui stanno entità, porte, implementazioni degli use
case e DI. Non dipende né dalle app né dagli adapter (`docs/adr/0010`): lo
schema sta in `@itec/db` e ci si arriva da `@itec/d1-adapter`.

Oggi ci sono il **modulo di Arca** (`docs/adr/0006`): le porte e gli use case
di tutti e due i lati dello specchio, e lo stato della sonda come entità; e
**l'accesso**: l'entità `Utente`, con i ruoli come coppie ruolo-BU e il flag
Amministratore, l'entità `TentativiAccesso`, gli use case di `accesso`
(login, rilettura dell'utente, cambio della password, utenti iniziali) e di
`utenti` (la gestione dell'Amministratore), e `Pbkdf2PasswordHasher`, che usa
WebCrypto e gira uguale su Node e nei Worker.

Poi **i clienti** (`clienti`): `Cliente`, col codice di tre caratteri che è
la sua chiave, e `RagioneSociale`, un'anagrafica cliente di Arca attribuita a
un cliente, col nome letto dallo specchio; e la proposta d'attribuzione delle
ragioni sociali che non ne hanno, con le regole dell'HTML.

Poi **le offerte** (`offerte`): `Offerta`, con l'anagrafica e la squadra, che
nasce In redazione col codice pratica. La regola del codice, di offerte e
commesse, sta in un punto solo, `src/rule/codicePratica.ts`; quella della
squadra (il BP fra i BP della BU) in `useCase/offerte/impl/squadra.ts`, sopra
`useCase/squadra.ts`, che dice chi ha un ruolo sulla BU per offerte e commesse. Il
budget dell'offerta (materiali e manodopera, Fixed Price o Time & Material) si
salva col suo use case, `UpdateBudgetOfferta`; le sue regole, compresi il
margine atteso e la condizione per uscire da In redazione, stanno in
`src/rule/budget.ts`, che la webapp usa anche nel browser per ricalcolare
mentre si scrive. Lo stesso budget, con subappalti e altri costi, è quello
della commessa e delle sottocommesse, e `UpdateBudgetCommessa` lo scrive dove
dice il livello del budget; il valore della commessa, che segue il livello,
lo calcola `valoreCommessa`, e `budgetCompilatoAlSuoLivello` dice se il budget
è compilato dove deve. La logistica fa lo stesso con
`UpdateLogisticaCommessa` e il livello della logistica; le sue regole stanno in
`src/rule/logistica.ts`: `inRitardo`, il segnale, che non è una fase,
`logisticaCompilataAlSuoLivello` e il periodo del Gantt.

Le fasi dell'offerta si cambiano con use case loro (Passa a, Autorizza,
Accettata, Torna a, Archivia, Ripristina), tutti attraverso
`useCase/passaggio.ts`: il passaggio si fa sulla versione `v` che l'utente ha
visto, o è `OutdatedPraticaError`, e scrive una riga nella traccia dei passaggi
(`IPassaggioRepository`), che vale anche per commesse e sottocommesse. Le regole
del percorso (dove porta «Passa a», dove «Torna a», chi ha autorizzato) stanno
in `src/rule/fasiOfferta.ts`; la soglia di autorizzazione si legge solo in
`src/di/installConfig.ts`, dalla variabile d'ambiente `SOGLIA_AUTORIZZAZIONE`.
L'archivio è l'`archiviazione` della pratica, che conserva la fase: non è il
`deleted_at`.

Poi **le commesse** (`commesse`): `Commessa`, che nasce Da programmare dalla
conversione di un'offerta Accettata (`ConvertiOfferta`, attraverso
`passaggio()`: l'offerta va in archivio come Convertita nella stessa Unit of
Work) o diretta (`CreateCommessa`). Ha l'anagrafica coi due livelli, la squadra
(`useCase/commesse/impl/squadra.ts`) e le sottocommesse, che stanno
nell'entità e si salvano con lei: il loro codice è quello della commessa e
«-NN», col massimo già usato più uno, e una cancellata resta col suo numero
perché il codice non torni. L'offerta extra su una commessa esistente è
`offerte.CreateOffertaExtra`.

Le fasi della commessa (Passa a, Torna a, Archivia, Ripristina) passano anche
loro da `passaggio()`, una alla volta e sempre a mano: niente avanzamenti alla
data, nessuna fase saltata. Le regole sono in `src/rule/fasiCommessa.ts`, con
quel che manca per Programmata (`mancaPerProgrammata`). In archivio, come
l'offerta, la commessa è in sola lettura, sottocommesse comprese.

Poi **i permessi** (`permessi`, `docs/adr/0013`): la matrice ruolo × azione,
che l'Amministratore legge e salva tutta (`docs/adr/0014`). La regola sta in
due entità. `Pratica`, la base di `Offerta` e `Commessa`, dice con `ruoliDi`
quali ruoli dell'utente valgono su di lei: nessuno fuori dalle sue BU, e il
PM/BO solo se è in squadra. `Matrice` dice con `consente` se uno di quei ruoli
ha l'azione, con `vietate` quali pulsanti del percorso spegnere e con `filtro`
dove gli elenchi mostrano le pratiche per `vedi`. Le policy
stanno in `src/auth/policy/`, una per file. Per le pratiche una base
(`OffertaPolicy`, `CommessaPolicy` o `CreatePolicy`) carica la pratica, e la
sottoclasse dice l'azione.

## Come si aggiunge

- **Un use case** del modulo `m`: l'interfaccia in
  `contract/src/useCase/m/I<Nome>.ts`, con la sua riga in `<M>UseCases.ts`;
  l'implementazione in `src/useCase/m/impl/<Nome>.ts`, con la sua riga in
  `src/useCase/m/<M>Module.ts`; la sua policy in `src/auth/policies.ts`
  (`docs/adr/0013`): se è nuova, va in un file a sé in `src/auth/policy/`. Se ne manca una, non compila. Lo schema dell'input sta
  nel file dell'interfaccia, e l'implementazione ne usa il tipo.
- **Un errore**:
  `class <Nome>Error extends TaggedError("<Nome>Error")<{ campi }> {}` in
  `contract/src/errors/` se compare nella `Error` di uno use case; qui, in
  `src/errors/`, se è l'errore di una porta che lo use case gestisce. I guasti
  dell'infrastruttura sono eccezioni. Se lo vede l'utente, il messaggio va in
  `apps/webapp/app/errori.ts`, e il tipo lo pretende.
- **Un modulo**: `contract/src/useCase/<m>/<M>UseCases.ts` con una riga in
  `contract/src/registry.ts`; `src/useCase/<m>/<M>Module.ts` con una riga in
  `src/di/install.ts`.
- **Un'entità** (`docs/adr/0011`): `src/entity/<Entità>.ts` che estende
  `Entity`, con la versione `v` che le passa il mapper e `create()` a `v = 0`;
  la porta `src/repo/I<Entità>Repository.ts` con le letture e un solo
  `save(entity): void`, che accoda; la repository in `@itec/d1-adapter`,
  `@injectable()` sulla `D1UnitOfWork`, con l'`UPDATE` controllato da
  `v = CASE WHEN v = ? THEN v + 1 END`; una riga in `installD1`,
  `inRequestScope()`; la colonna `v INTEGER NOT NULL DEFAULT 1`; e una chiamata
  a `pattoDelSave` in `apps/webapp/test/salvataggio.test.ts`. Lo use case che
  scrive lavora dentro `runWithTransaction` e mette `ConflictError` nella sua
  `Error`.

## Come si compila

In `dist/` (`tsc --build`, poi `tsc-alias` che riscrive gli alias `~/` in
percorsi relativi), che non si versiona: gli altri pacchetti importano da lì,
per percorso (`@itec/core/di/install`), JavaScript e dichiarazioni, anche
su Node. Alla radice `pnpm build` ricostruisce contract e core in ordine, e
`pnpm typecheck` e `pnpm test` lo fanno da sé prima di partire; i test del
core invece leggono i sorgenti, e al posto degli adapter usano i falsi di
`src/_testing`.
