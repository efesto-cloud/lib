# Registro delle osservazioni per Blueprint

> Copiato dal CRM ITEC (`thera-capital/crm-itec`, `.claude/epic-41/registro-blueprint.md`,
> che non è versionato). I numeri `#…` sono issue di quel repo; i percorsi `R/`, `H:`,
> `EX` della tabella di confronto sono del Blueprint su questo branch. Da trasformare in
> handoff: non ancora processato.

Osservazioni di Dario sul lavoro dell'epic #41 (in particolare #78, contract/core),
da riportare in Blueprint: punti dove le istruzioni non sono state abbastanza chiare.
Raccolte l'11/11/2026, ancora da processare: prima si finisce di ascoltare.

## 1. L'input dello use case è uno schema zod nel contratto

- Atteso: l'input di ogni use case si definisce in `@itec/contract` come schema zod.
- Il core importa lo schema da lì, e ne ricava il tipo dell'input già tipizzato.
- Fatto da #78: non è stato fatto così.

## 2. Schemi indipendenti dalla libreria (domanda aperta)

- Dario ricorda che con better-result c'era forse un modo di gestire gli schemi
  indipendente dalla libreria (non legato a zod).
- Da verificare (forse Standard Schema). Potrebbe servire anche per il punto 3.

## 3. Confusione fra `type` e DTO

- Alcune cose messe in `type` andrebbero in DTO, ed è sbagliato in modo consistente.
- Dario spiega come concepiva `type`, poi ci si mette d'accordo: forse è il
  concetto iniziale da precisare in Blueprint.
- (in attesa della spiegazione)

### La spiegazione di Dario (11/11)

- **`type`**: union di stringhe, struct semplici e strutture particolari
  (es. un `Record`). Niente che rappresenti un'entità.
- **DTO**: l'interfaccia di un'entità come esce serializzata in risposta a
  uno use case. Uno per entità. Nome col prefisso `I` e senza suffisso:
  `IUtente`, non `UtenteDto`.
- **Proposta da valutare**: superare il concetto di DTO e definirli direttamente
  come schemi (cartella `interfaces` o `schemas`), con zod oppure con la
  libreria generica di cui al punto 2.
- **Cosa c'è oggi nel contract** che non torna con questa idea:
  - `type/SyncLogEntry.ts` e `type/ProbeStateChange.ts` sono righe serializzate
    di un'entità/registro: sarebbero `ISyncLogEntry`, `IProbeStateChange`;
  - `dto/UtenteDto.ts` → `IUtente`;
  - `dto/DatiUtente.ts` è un input di use case: col punto 1 sarebbe uno schema.

## 4. `taggedError` e il suo codec zod: perché?

- Domanda di Dario: a cosa serve lo `static codec`, da dove viene, si usa?
- Fatti: la richiesta veniva dal corpo di #78 (scritto dal coordinatore nel
  grilling): «un helper `taggedError(tag, shape)` che dà la classe e il suo
  codec zod», pensato per far viaggiare gli errori sul canale e ricostruirli
  dall'altra parte. **In produzione non lo chiama nessuno**: lo usano solo i
  test di `taggedError.test.ts`. È complessità senza un uso.

## 5. Il container vive nella composition root, non nel core

- Oggi `packages/core/src/di/container.ts` crea il `Container` a livello di modulo
  (un singleton globale), con `initContainer()` lazy e un flag `initialized`.
- Il container in realtà è esportato (default), ma lo importano solo le
  composition root: `sonda/src/index.ts`, `webapp/workers/bootstrap.ts`,
  `webapp/seed/index.ts`, più il test `webapp/test/sonda.test.ts`, che lega i
  suoi stub sullo stesso singleton della webapp passando dal modulo, non da
  un container suo.
- Proposta di Dario: il core espone solo un **install**, che carica i moduli
  degli use case su un container che gli viene passato; il `new Container()`
  lo fa la composition root. Così non servono né il singleton né il flag lazy.
- Per Blueprint: distinguere `init` (creare il container, compito della
  composition root) da `install` (caricare i moduli, compito del core).

## 6. Poche entity

- Nel core c'è una sola entity: `entity/Utente.ts`, scritta a mano (non sopra
  `@efesto-cloud/entity`).
- `Sessione` è un'interfaccia dentro `repo/ISessioneRepository.ts`;
  `TentativiAccesso` è passato al repo come valore; il giro di sync e il
  `SyncBlock` non hanno un'entity.
- Dario: un'entity per ogni tabella di Arca è troppo, comprensibile; ma per il
  giro di sync / `SyncBlock` si aspettava qualcosa.

## 7. Il patto del `save` (da discutere per tutti i Blueprint futuri)

- Pratica di Dario: la repository ha **un solo `save(entity)`**. L'implementazione
  guarda lo stato dell'entity: nuova → INSERT, modificata → UPDATE,
  eliminata (soft, `deleted_at`) → DELETE/aggiornamento. L'entity porta con sé
  come capirlo (`updated_at`, dirty, `deleted_at`).
- Oggi: `IUtenteRepository` ha `create(utente)` **e** `save(utente)`;
  `ISessioneRepository` ha `save` + `delete(id)` + `deleteForUtente`;
  `ITentativiAccessoRepository` ha `save(username, …)` + `delete(username)`.
  `Utente` ha `created_at` e `deleted_at` ma niente `updated_at` né stato dirty.
- Il patto va scritto in Blueprint, e rispettato sia dall'entity sia
  dall'implementazione della repository.
- Tema collegato: **optimistic concurrency** (Dario stava per spiegarlo).

## 8. Optimistic concurrency con una `version`

- Idea di Dario: l'entity porta una `version`; il `save` aggiorna solo se la riga
  ha ancora la versione letta (`UPDATE … WHERE id = ? AND version = ?`, poi
  `version + 1`). Se non tocca nessuna riga, qualcuno l'ha cambiata nel frattempo:
  errore di conflitto, e non c'è niente da annullare perché non è stato scritto niente.
- Dubbio di Dario: quanto costa applicarlo e mantenerlo, perché è un patto da
  rispettare in modo rigido (entity + ogni implementazione di repository).
- Alternativa che sta considerando: mandare in pensione il `save` unico e …
  (frase rimasta a metà).
- Fatto utile: D1 non ha transazioni interattive (niente BEGIN/lock tenuti fra
  una lettura e una scrittura), solo `batch` atomici. Il controllo sulla
  versione dentro l'UPDATE è proprio il meccanismo che su D1 funziona.
  … e passare a metodi puntuali: CRUD classico (`create`, `delete`, …) più
  le query specifiche che servono.

## Obiettivo (Dario, 11/11)

Discutere punto per punto; sistemare subito nel CRM ITEC (branch di fix o nella
coda dell'epic); poi riportare in Blueprint ciò che funziona e piace, come
spunto e osservazione per chi manterrà ed evolverà il Blueprint.

## Cosa dice già il Blueprint (skill `efesto-cloud/Core`, letto l'11/11)

> **Attenzione**: questa sezione è stata letta dalla skill installata, che è
> **vecchia**. Il Blueprint vero è in `~/efesto-cloud/lib`, branch
> `docs/32-skill-blueprint` (`plugins/blueprint/`, note in `docs/superpowers/notes/`).
> Il confronto punto per punto con quello è nella sezione «Confronto col Blueprint».

- **Entity**: la base `Entity` di `@efesto-cloud/entity` ha già `v` (versione,
  0 = nuova), `isNew()`, `isUpdated()`, `delete()`/`restore()`/`isDeleted()`.
- **Repository**: `search`, `get`, **un solo `save(entity)`**. Quindi i punti 7–8
  sono già nel Blueprint: il CRM non li ha seguiti (`Utente` scritta a mano).
  Manca nel Blueprint il patto esplicito su come `save` usa `v` (UPDATE … WHERE v = ?).
- **DTO, contraddizione interna**: `core/SKILL.md` dice `dto/FooDto.ts`
  (`<Entity>Dto`), `entity/SKILL.md` dice `toDTO(): IEntityName`. #72 ha seguito
  la prima forma (`UtenteDto`). Da allineare in Blueprint.

## Decisioni del primo giro (Dario, 11/11)

- **4 (errori)**: l'errore serializzato basta che sia un oggetto semplice tipizzato
  `{ _tag, …campi extra }`, non una classe: il tag distingue, i campi danno
  messaggi più precisi. Via il codec. (Q6 sulla forma nativa: in attesa.)
- **5 (container)**: lo crea la composition root, il core espone solo l'install. Deciso.
- **Q1**: il `parse` dell'input lo fa chi chiama, al bordo, con lo schema del
  contract; lo use case riceve l'input già tipizzato. In linea coi principi di
  Blueprint: **verificare che sia scritto in Blueprint, altrimenti riportarlo**.
- **Q2**: gli input vivono con lo use case (sono il suo input), non in una
  cartella a parte. Stesso file o file diverso: da decidere.
- **Q3**: si tiene save + versione. Da valutare upsert al posto di insert/update.
  Principio di Dario: **i record che non sono entity vanno evitati**, si rendono
  entity per avere una linea comune — dove ha senso. Per Arca non un'entity per
  tabella, ma da valutare un'entity base comune alle tabelle dello specchio
  (attributi e funzioni di sincronizzazione). **Non legarsi a D1**: nella realtà
  si usano PostgreSQL, SQLite, D1 e MongoDB (in dismissione). Il save va
  chiarito bene, non chiuso con una domanda.
- **Domanda di Dario**: con save + versione, su D1 il `batch` (l'unica vera
  transazione) può coprire più repository, o solo una per volta?
- **Q4**: niente entity per ciò che è append-only, stile log: nessun vantaggio.
- **Q5**: si fa subito, appena chiarito tutto.

## Fatti verificati per il save

- (Dalla skill installata, vecchia.) Il Blueprint ha già un `DatabaseContext` per richiesta (`InternalSymbols.DatabaseContext`,
  `inRequestScope`) con `runWithTransaction(callback)`: le scritture di più repo
  nella callback condividono la transazione. È pensato per Prisma/Postgres
  (transazioni interattive), che su D1 non esistono.
- Prova su SQLite (`node:sqlite`, stesso motore di D1): un trigger
  `BEFORE UPDATE … WHEN NEW.v <> OLD.v + 1 → RAISE(ABORT)` fa fallire l'UPDATE
  con versione vecchia, e dentro una transazione annulla anche le scritture
  delle altre tabelle. Un `UPDATE … WHERE v = ?` da solo invece non fallisce
  (tocca zero righe), quindi in un batch non annullerebbe niente.

## Decisioni del secondo giro (Dario, 11/11)

- **Q6**: via l'helper `taggedError`, forma nativa di better-result. In webapp si
  usa l'errore così com'è e si disambigua per `_tag` con `match`. **Codificare un
  errore è responsabilità di chi lo espone (un'API HTTP avrà il suo mapper per
  errore), non del contract**: la codifica cambia col mezzo. → Blueprint.
- **Q7**: tutto o niente, sì. Le letture non vedono le scritture in coda *della
  stessa transazione*; possono vedere dati che intanto qualcuno ha cambiato, e lì
  interviene la versione. Il controllo si sposta al salvataggio: più leggero per
  il db, nessuna riga tenuta bloccata per tutta la durata dello use case.
- **Q8**: `runWithTransaction` restituisce `Result<T, ConflictError>`. Aperto: retry
  automatico o errore all'utente? (Il driver MongoDB ritenta da solo.)
- **Q9**: insert/update separati dentro `save`, scelti con `isNew()`. Niente upsert.
- **Q10**: d'accordo sulle quattro entity. Però: **`deleted_at` porta soft deletion,
  ed è una decisione di dominio, non un default**; **`created_at`/`updated_at` si
  mettono quando servono, con un motivo, non sempre**. → Blueprint: la base
  `Entity` oggi ha `delete()/restore()/isDeleted()` per tutti, va resa opzionale.

## Decisioni del terzo giro (Dario, 11/11)

- **Prassi**: esagonale + Unit of Work (Fowler PoEAA; Hibernate flush, EF Core
  SaveChanges, MikroORM) + optimistic locking (`@Version`, `lock_version`) +
  retry sul conflitto (driver MongoDB) sono tutti standard. Lo scriviamo a mano
  perché nessun ORM copre bene D1 + Postgres + SQLite + Mongo.
- **Default: vince l'ultima scrittura** fra persone (prassi di quasi tutti i
  gestionali). Niente `v` nel form.
- **Q11**: la `v` la carica l'entity in modo trasparente (nel mapper della repo
  impl) e si controlla all'esecuzione della coda.
- **Q12**: `runWithTransaction` ripete la callback da capo sul conflitto, un numero
  fisso di volte, poi `ConflictError`. **Da segnare**: alcuni use case vorranno
  invece «o va o errore», quando una persona ha deciso su ciò che ha visto (es.
  un'approvazione sopra soglia: chi approva ha visto un importo, intanto un
  altro lo cambia). Lì la `v` arriva dall'input e il retry si spegne.

## Dopo il preflight (Dario, 11/11)

- **Il `parse` non è indispensabile** dove il dato arriva già validato e tipizzato
  (in un loader o in un'action); serve dove entra un dato grezzo. (#88 aggiornata.)
- **Prima di scrivere nel Blueprint** si guarda come lo sistemiamo qui e quanto risolve.
- **Domanda nuova, fondamentale**: dividere il monorepo in `packages/`, `apps/`,
  `adapters/`? (Precedente: `efesto-cloud/agent` ha già `packages/`, `adapters/`
  `*-adapter`, `apps/`, `vendor/`.)
- **Trigger o conteggio delle righe?** (domanda di Dario) Il conteggio basta con
  transazioni interattive (Postgres, SQLite); su D1 il batch dà i conteggi solo a
  commit avvenuto, quindi non annulla. Soluzione senza trigger, provata:
  `SET v = CASE WHEN v = ?letta THEN v + 1 END` con `v NOT NULL` → con versione
  vecchia il vincolo fa fallire l'UPDATE e il batch si annulla. Portabile. #89 aggiornata.

## Struttura del monorepo (Dario, 11/11) → #90

- `apps/` (composition root: webapp, sonda), `packages/` (contract, core, db, legacy),
  `adapters/` (`<tecnologia>-adapter`: d1, sqlserver, http, stub). Regola:
  app → adapter → core/contract; core → contract; nessuno importa un'app.
- Lo `stub-adapter` raccoglie anche i dati mock (il seed dell'Arca finta).
- Per il Blueprint: questa struttura e l'ADR andranno nella skill, e verranno
  copiati nel repo durante la fase di setup.

## 9. Ogni adapter esporta il suo install (Dario, 11/11) → #89, e Blueprint

- Oggi le composition root legano a mano ogni adapter con `toConstantValue(new …)`
  (niente errori: Inversify non costruisce, quindi `@injectable()` non serve).
- Deciso: ogni adapter esporta `install<Tecnologia>(opts): ContainerModule`, con i
  suoi binding, simboli e configurazione; la composition root carica i moduli
  (come `efesto-cloud/agent`: `installPrisma`, `installR2`, `installStub`).
- Necessario con la Unit of Work: il contesto di transazione è per richiesta e
  le repository lo ricevono, quindi le costruisce Inversify.
- **Da segnare in Blueprint** insieme agli altri punti.

## 10. Si chiama Unit of Work, non DatabaseContext (Dario, 11/11)

- Nel Blueprint era già stato deciso: «DatabaseContext» è un nome sbagliato, la cosa
  è una **Unit of Work**. Interfaccia `IUnitOfWork`, simbolo `UnitOfWork`, forma
  corta sempre `uow` minuscolo. Ovunque: simboli, interfacce, variabili, commenti.
- Il corpo di #89 diceva «contesto» e il commento di #88 «DatabaseContext»: errore
  nostro nel passaggio. La skill installata è vecchia: il Blueprint è
  in lavorazione su `efesto-cloud/lib`, branch `docs/32-skill-blueprint`.

## Confronto col Blueprint (branch `efesto-cloud/lib` `docs/32-skill-blueprint`, 11/11)

Fatto da un agente in sola lettura. `R` = `plugins/blueprint/skills/blueprint/references/`,
`H` = `docs/superpowers/notes/blueprint/index.html` (il documento delle decisioni,
righe contate senza tag), `EX` = `example/2c-bus/` sul branch `spike/better-result`.
**Il nodo**: `H` ed `EX` sono avanti, `SKILL.md` e references sono indietro
(`punti-aperti.md:183-184`: da riscrivere a partire da `example/`). Su più punti
il CRM ha seguito la skill, cioè la parte vecchia.

A = scritto uguale (non seguito) · B = scritto diverso / contraddetto · C = non scritto

| punto | | dove | nota |
|---|---|---|---|
| 1 input schema nel contract | B | H:299, H:465, EX `contract/src/useCase/expenses/ApproveExpense.ts:7-18` ↔ R/usecase.md:278, R/dto.md:3-6 | doc/esempio: schema nel contract; skill: DTO nel core |
| Q1 parse al bordo | A | R/usecase.md:270-275, R/dto.md:207-213, H:1068-1070 | manca «non serve se già tipizzato» |
| Q2 input vicino allo use case | A parz. | EX `inputs.ts`, `ApproveExpense.ts:10` | solo nell'esempio, nessuna regola |
| 2 Standard Schema | A parz. | H:1222, H:1264 | principio scritto; l'esempio è legato a zod (`bus/src/dispatcher.ts:47`) |
| 3 DTO / `IUtente` | B | R/dto.md:23-31 (`FooDto`), SKILL.md:129 ↔ skills/entity/SKILL.md:32 (`IEntityName`); EX `dto/ExpenseDto.ts` (schema zod) | il CRM ha seguito dto.md |
| 3 significato di `type` | C | R/type-enum-dict.md | manca «niente che rappresenti un'entità» |
| 4/Q6 codec errori | B | H:470, H:1105, punti-aperti:58-61,105; EX `contract/src/errors/taggedError.ts` | **il CRM aveva seguito il Blueprint**: la decisione di Dario lo cambia |
| 5 container | B | R/composition-root.md:73, R/di-layer.md:9-14 ↔ EX `bootstrap/src/base.ts:59-71` | esempio già come Dario |
| 6 quando un'entity | C | R/entity.md:10-11 | nessun criterio; niente entity base per lo specchio |
| Q4 log append-only | B | R/usecase.md:264-266 (entity) ↔ EX `core/src/entity/ExpenseStatusChange.ts` (interfaccia) | |
| 7 un solo `save` | A | R/repository-port.md:67-69, SKILL.md:110-111 | non seguito |
| Q9 insert/update vs upsert | B | R/repository-port.md:67, R/prisma-persistence.md:222,423; EX `db-adapter/src/ExpenseRepository.ts:54-62` | Blueprint: upsert; deciso: separati |
| 8/Q11/Q12 versione, conflitto, retry | C | solo `v`/`isNew()` in R/entity.md:51-53 | manca tutto il patto |
| Q7 batch D1 | C | punti-aperti:42-44 («parcheggiato»), H:932-934 | |
| UoW rientrante per richiesta | A | H:921-930, EX `db-adapter/src/index.ts:12` | |
| 10 nome `UnitOfWork`/`uow` | B | R/di-layer.md:30,104, R/prisma-persistence.md:37,372, skills/usecase/SKILL.md:102 ↔ EX `core/src/di/Port.ts:4`, `ApproveExpense.ts:15` | rename solo nell'esempio, non scritto come decisione |
| Q10 soft delete/timestamp opzionali | B | R/entity.md:10-11,52-57,68-70,84-85, SKILL.md:110 | Blueprint: di default |
| struttura `apps/` | B/C | SKILL.md:71-83, H:639-716 | `apps/` non esiste nel Blueprint |
| 9 `install*` per adapter | A | R/architecture.md:86-91, R/composition-root.md:212, recap:67; EX `adapters/*/src/index.ts` | non seguito |

Contraddizioni interne al Blueprint: container (skill vs esempio); nome DTO
(`FooDto` vs `IEntityName` vs schema `ExpenseDto`); dove sta l'input (core vs
contract); simbolo UoW (`DatabaseContext`/`IDatabaseContext` vs `Port.UnitOfWork`);
`R/tagged-error.md` e `R/result-codec.md` descrivono pacchetti che
`punti-aperti.md:169-172` e H:1237-1238 danno da ritirare per better-result.

## Come si usa questo registro (Dario, 11/11)

Le divergenze col Blueprint sono attese: è un work in progress. Tutto quello che è
qui diventa un **handoff nel Blueprint** (`efesto-cloud/lib`, `docs/32-skill-blueprint`)
quando #89 è chiuso e abbiamo visto quanto risolve nel CRM.

## 11. `isUpdated()` non c'è più (curiosità di Dario, 11/11: nessuna azione)

- La base di #89 ha `isNew()` (`v === 0`) e `isRemoved()` (cancellazione vera); il
  `save` fa UPDATE quando non è né nuova né rimossa. Il soft delete di `Utente` è
  un UPDATE di `deleted_at`.
- Nel Blueprint vecchio `isUpdated()` era `v !== 0`, cioè solo `!isNew()`: non
  diceva «modificata», e il nome ingannava.
- Oggi non c'è dirty tracking: un `save` senza modifiche fa comunque l'UPDATE e
  alza `v`. Non serve finché gli use case salvano solo ciò che cambiano.

## Come è andata nel CRM, dopo #88/#89 (11/11, prime due tabelle nuove)

- **#60 (`Cliente`, `RagioneSociale`)**: la ricetta dell'ADR 0011 (entity sulla
  base del core, porta con letture e `save`, repository `inRequestScope` nell'install
  dell'adapter, migrazione con `v`, test del patto) è bastata senza intoppi. Per
  le tabelle **nuove** `prisma migrate diff` genera già la `v` giusta: la
  migrazione scritta a mano serve solo per le tabelle che esistono (il `DROP` +
  `CASCADE` di D1).
- **#60**: un codice scelto dall'utente come chiave primaria fa coincidere il
  vincolo di unicità con il conflitto della Unit of Work (`UNIQUE` violato →
  ripetizione → la rilettura dà l'errore di dominio giusto). Pattern da
  riportare.
- **#81 (`Offerta`)**: il `UNIQUE` sul codice composto **non** protegge il
  progressivo «massimo più uno»: con clienti diversi i codici differiscono e il
  progressivo si ripete senza conflitto. Serve una colonna del progressivo con
  il suo `UNIQUE`. → Blueprint: il vincolo va sulla cosa che deve essere unica,
  non su un derivato che la contiene.
- **«Ultima scrittura vince»** si è visto anche fuori dalle approvazioni: una
  proposta applicata da una pagina vecchia sposta un'attribuzione fatta da altri
  nel frattempo (#60). Conferma la nota di Q8/Q12: serve un modo dichiarato per
  gli use case «o va o errore» (attesa dall'input, senza ripetizione).
- **Rumore della UI**, non del core: i componenti dei form si copiano fra pagine
  (#95). Fuori dal perimetro del Blueprint del core, ma da tenere per la parte
  webapp se ci sarà.
