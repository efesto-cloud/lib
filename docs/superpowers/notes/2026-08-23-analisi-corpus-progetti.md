# Cosa dicono cinque progetti veri sulla libreria e sulle skill

Ricognizione del 2026-08-23 su **arsenale, giunone, dav, oasis, task-planning**:
134 file di entity, 604 implementazioni di use case, 1387 file sotto `useCase/`.
Ogni numero qui sotto è misurato sul codice, non stimato.

Cronologia dei repo (primo → ultimo commit), che è la chiave di lettura di tutto
il resto:

| progetto | dal | all' | entity | UC impl | id | DTO |
|---|---|---|---|---|---|---|
| arsenale | 2024-06 | 2026-07 | 14 | 59 | `string` (migrato) | `I*` |
| giunone | 2024-12 | 2026-06 | 37 | 164 | `ObjectId` | `I*` |
| dav | 2025-04 | 2026-08 | 51 | 202 | `ObjectId` | `I*` |
| oasis | 2025-09 | 2026-06 | 17 | 89 | `string` | `I*` |
| task-planning | 2026-04 | 2026-07 | 15 | 90 | `string` | `*Dto` |

---

## 1. Il problema principale: il plugin contiene due generazioni che si contraddicono

`plugins/core/skills/core/references/*` descrive il mondo **nuovo** (quello di
task-planning): id `string`, `FooDto`, `DomainError` astratto con una classe per
condizione, value object con `create(): Result`, `InternalSymbols` /
`UseCaseSymbols` / `UseCaseRegistry` / `resolveUseCase`.

Le skill autonome `entity`, `usecase`, `value-object`, `persistence` descrivono il
mondo **vecchio** (quello di giunone/dav del 2024): `ObjectId`, `IEntityName`,
`@audit`, `WithAuth<>`, `throw new Error` nei value object, binding monolitico in
`container.ts`.

Contraddizioni verificate riga per riga:

| tema | `core/references/` | skill autonoma | cosa fa il codice |
|---|---|---|---|
| id entity | `id ?? randomUUID()` | `new ObjectId(id)` | 33 file `string`, 74 `ObjectId` — ma i 33 sono i 3 progetti più recenti |
| DTO | `FooDto.ts` | `IEntityName.ts` | 121 `I*`, 16 `*Dto` (solo task-planning) |
| VO invalido | `create(): Result<VO, E>` | «throw `new Error`» | task-planning usa Result; oasis/dav costruiscono VO invalidi (vedi §3) |
| errori | `DomainError` + una classe per condizione | non ne parla | task-planning 58 classi; gli altri 4 errori generici parametrici |
| binding UC | `<Domain>Module.ts` + registry | union in `Symbols.ts` + riga in `container.ts` | 3 progetti su 5 hanno già i moduli |

**È il problema più costoso**, perché le skill autonome hanno `description` più
strette e quindi *si attivano più facilmente* di `Core:core`. Chi chiede «aggiungi
un campo a Bar» prende `entity`, cioè la generazione vecchia, e riporta indietro un
codebase nuovo.

**Proposta:** le quattro skill autonome smettono di essere una seconda fonte di
verità e diventano **procedure sottili** (checklist + ordine delle operazioni) che
delegano il *contenuto* a `core/references/`. Una sola definizione per ogni regola.

---

## 2. Guida morta: `@audit` è nella checklist e non esiste in natura

> **Stato: fatto (2026-08-23).** Dario ha confermato che `@audit` è morto. La
> guida è stata rimossa da `usecase/SKILL.md`, dai tre template di
> `usecase/references/templates.md` e da `core/references/usecase.md`, e
> sostituita dalla domanda di dominio. Il package `@efesto-cloud/audit` è stato
> **rimosso dal repo** (`packages/audit/`, la voce in `knip.json`, il lockfile:
> `check-packages` passa da 25 a 24 package pubblici). Restano su npm le versioni
> 0.0.1–0.0.4 già pubblicate — rimuovere dal repo non le ritira: manca solo
> `npm deprecate`, che è un'azione verso l'esterno e non è stata fatta.

> **Stesso giro, `@withTransaction`.** Dario: «non lo userei così alla cieca,
> piuttosto si usa il tool unit of work con transaction». Il decoratore è stato
> tolto anche lui dai tre template — dove per giunta avvolgeva una singola
> `repo.save()`, cioè non serviva a niente — e declassato a «cosa che alcuni
> codebase hanno», non a strumento da introdurre. Al suo posto la skill ora fa
> una domanda: *due o più scritture che devono atterrare insieme?* Se sì,
> `IUnitOfWork.runWithTransaction` attorno alle sole scritture; se no, niente
> transazione. Aggiunto un template MULTI-WRITE che mostra il caso vero
> (entità + riga di storico).

- `@audit` compare **0 volte su 604** implementazioni di use case.
- `@efesto-cloud/audit` è usato da **0 progetti su 5**, dopo due anni.
- Eppure `usecase/SKILL.md` lo mette fra i quattro artefatti obbligatori e lo
  richiede nella checklist finale («`@audit` present for all mutating operations»).

Il package è scritto bene (decoratore + `AuditTraceBuilder` + `AsyncLocalStorage`).
Il punto non è la qualità: è che **il bisogno esiste e viene risolto altrove**.
task-planning ha costruito `PraticaStatusChange` — un'entità di dominio con lo
storico delle transizioni, scritta esplicitamente dallo use case. dav ha
`OutboxEvent` + `outbox/`. Cioè: la traccia che serve davvero è *di dominio,
interrogabile, con lo schema del dominio*, non un trace trasversale generico.

**Proposta:** togliere `@audit` dalla checklist obbligatoria e sostituirlo con la
domanda vera — «questa operazione ha bisogno di uno storico? allora è un'entità
(`FooStatusChange`) o un evento outbox, non un decoratore». Tenere `@efesto-cloud/audit`
documentato come opzione per la telemetria, non come regola.

---

## 3. Anti-pattern misurati (due dei quali li causiamo noi)

**a. Default vuoti su campi obbligatori — 97 occorrenze di `?? ""`.**
`entity/SKILL.md` dice: «The majority of `create()` props are optional with `??`
defaults». Il risultato in natura è `DictEntry.create({})` che produce
`{type: "NAZIONALITA", value: "NUOVO", label: "nuovo"}` — un'entità legale e priva
di senso. Il contro-esempio giusto è `Pratica.create`, dove `name` è obbligatorio,
validato, e la factory ritorna `Result`.
→ La regola va rovesciata: **opzionale solo ciò che ha un default di dominio**; il
resto è obbligatorio, e se può fallire la factory ritorna `Result`.

**b. Value object costruibili invalidi.** oasis/dav espongono il costruttore
pubblico e la validità come *getter* (`get isValid()`): un `EmailAddress` con
dentro `"pippo"` è un oggetto valido a compile-time. task-planning ha la forma
corretta — `private constructor` + `static create(): Result<VO, DomainError>` +
`toRaw()`. La skill `value-object` prescrive `private constructor` (bene) ma poi
dice di **lanciare** `new Error` sull'invalido: incoerente con il resto
dell'ecosistema, che è tutto `Result`.

**c. Use case che compongono use case:** 10 in giunone, 13 in dav, 0 nei tre
restanti. `core/references/usecase.md` lo sconsiglia già; manca però la via d'uscita
esplicita — estrarre la parte comune in un *service port* o in una funzione pura.

**Nota positiva, e vale la pena scriverla:** in **0 file su 134** un'entity importa
un repo o un service. Il confine di dipendenza esagonale regge in tutti e cinque i
progetti, incluso il più vecchio. Non serve difenderlo, serve solo non romperlo.

---

## 4. Pattern maturi che le skill non nominano affatto

**a. I test — il buco più grande.** 84 file di test in task-planning, **0** negli
altri quattro. Nessuna skill del plugin nomina i test. E il pattern che
task-planning ha trovato è ottimo e riusabile:
- `_testing/fixtures.ts` (1117 righe): `makeAdmin()`, `makeCommessa()`,
  `makeProspect()`… factory con `overrides` e id deterministici;
- `InMemory<Foo>Repo implements IFooRepository` — l'adapter in memoria è
  *l'oracolo del port*: se il fake e Prisma divergono, il port è ambiguo. Con
  `seed()` fluente e un array `saved[]` come spia delle scritture;
- commenti che ancorano il fake al vincolo reale del DB (`findByCode` «rispecchia
  l'indice unico globale: deliberatamente NON filtrato per `deleted_at`»).

→ **Nuova skill `testing`** (o sezione in `core`), che è anche il modo per far
scendere quello 0 negli altri progetti.

**b. Il pattern plan/apply per le operazioni di massa.** `buildPaprikaPlan.ts`
(581 righe, **puro**: righe → piano + report) e `applyPaprikaPlan.ts` (impuro:
piano → scritture), entrambi testati separatamente, con lo use case ridotto a
cucitura. È la risposta corretta alla domanda «come testo un import da Excel», e
dà gratis la dry-run. Da codificare come pattern nominato.

**c. `adapters/` come workspace root.** task-planning ha 7 pacchetti adapter
(`prisma-adapter`, `stub-adapter`, `exceljs-adapter`, `jose-token-adapter`,
`ics-calendar-adapter`, `cloudflare-email-adapter`, `cloudflare-queue-adapter`),
ognuno esporta `/install` che ritorna un `ContainerModule`, e la composition root è
17 righe di `container.load(installX(...))`. Lo `stub-adapter` con `seed()` fa
girare l'app intera senza database.
`folder-structure.md` non nomina la cartella `adapters/`, e **2 dei 10 riferimenti
"seen in the wild" di `di-layer.md` puntano a file che non esistono più**
(`packages/prisma/src/install.ts`, `service/impl/installServices.ts`).

**d. `interface Foo` + `namespace Foo`.** Usato per i DTO (`MemberDto.Role`) e per
le opzioni dei repo (`IBambinoRepo.Options`). Idioma ricorrente, mai documentato.

---

## 5. Cosa aggiungere o cambiare nella libreria

**Duplicazione da eliminare (misurata):**

| cosa | dove è duplicato | proposta |
|---|---|---|
| `withTransaction` (27–39 righe) | arsenale, dav, oasis — identico a meno del simbolo DI | `createWithTransaction(symbol)` da `@efesto-cloud/unit-of-work` |
| `preserveConstructorName` | 3 progetti + `packages/audit` | esporlo da un package base |
| `DictEntry` (38–54 righe) | giunone, dav, oasis — identico a meno del tipo id | package o ricetta canonica |
| entity auth/OTP (`Email`, `OTP`, `EmailOTP`, `Operator`, `*Login`) | 3 progetti | è il candidato più grosso, e il più delicato |

**Port ricorrenti da standardizzare:** `IMailer`/`IEmailService` (5/5),
`IAuthService`/`IAuthenticator` (5/5), `IJobQueue` (3), `IFileStorage` (2),
`ITokenService` (2). Un `@efesto-cloud/ports` con le interfacce nude renderebbe
riusabili anche gli adapter.

**Forme divergenti da fissare in un tipo condiviso:** tutti i repo ritornano
`{items, total}`, ma la query è `page_size`/`page_n` (oasis) o `limit`/`offset`
(task-planning); il soft-delete è `include_deleted`, `includeDeleted` o
`onlyDeleted`. Un `Page<T>` / `PageQuery` / `DeletedFilter` costa poco e chiude una
scelta che oggi si rifà ogni volta.

**Adozione zero da guardare in faccia:** `audit`, `maybe-async`, `outbox`,
`prisma-expand`, `prisma-unit-of-work`, `result-async` (più `result-codec` e
`tagged-error`, che sono nuovi e quindi esclusi dal giudizio). Da decidere caso per
caso se è un problema di comunicazione o di astrazione sbagliata.

**Segnale su `maybe`:** i due progetti più recenti (task-planning) e più vecchio
(giunone) **non lo usano**; i repo port ritornano `Foo | null`. `Maybe` regge in
arsenale/dav/oasis. Non è un verdetto, ma la skill `monad-maybe` dovrebbe dire
quando *non* serve, invece di presupporlo.

**Pulizia:** `packages/login_session/` e `packages/protected-static-server/` sono
directory residue senza `package.json` (solo `dist/` e `node_modules/`).

**`tagged-error` ha un innesto naturale:** i 58 errori di task-planning
(`class PraticaCodeAlreadyExistsError extends DomainError {}`) sono esattamente la
forma che `TaggedError` + `matchError` esaustivo migliora. Vale una guida di
migrazione `DomainError → TaggedError`, che è anche il modo di dare al package la
sua prima adozione reale.

---

## 6. Cosa dice il log di task-observer

Sulle nostre skill ci sono due voci **internal** ancora OPEN, entrambe confermate
dal codice di oggi:

- **Oss. 23 — raggiungibilità della module augmentation.** Il registry aumentato
  via `declare module` funziona dentro il package e collassa a `never` fuori,
  perché `tsc` elide dalla declaration emit gli import usati solo nel corpo delle
  funzioni; `import type {} from` **non** sopravvive, l'import nudo sì. Il
  `server.ts` di task-planning fa oggi esattamente questo (11 righe
  `import "./useCase/<dominio>/<X>Module.js";`) — cioè la soluzione è già in
  produzione ma **non è scritta da nessuna parte**. Il troubleshooting di
  `di-layer.md` elenca 3 cause del `never` e non questa, che è la quarta e la più
  cara da diagnosticare.
- **Oss. 25 — istruzione vs registro.** Dopo un refactor strutturale vanno
  aggiornati i documenti che *insegnano* (guide, esempi «reference»), non quelli
  che *registrano* (piani e spec datati). Segnali: data nel titolo e caselle `[x]`
  = registro. Da mettere nella parte di `core` sulla manutenzione dei documenti —
  e vale anche per questo file, che è un registro.

Utile di sponda l'**oss. 24**: un vincolo di tipo si prova in coppia, il caso che
deve compilare *e* quello che deve essere respinto, confrontando il testo
dell'errore (`… of type 'never'` → `… of type 'keyof UseCaseRegistry'`) e non solo
l'exit code. È il test che dimostrerebbe l'oss. 23.

---

## 7. Ordine di attacco proposto

1. **Riconciliare le due generazioni** (§1) — è la correzione con il rapporto
   valore/costo più alto, e tutto il resto ci si appoggia.
2. **Togliere `@audit` dalla checklist** (§2) e riscrivere la regola come domanda
   di dominio.
3. **Correggere le tre regole che producono codice peggiore** (§3a, §3b, e i 2
   riferimenti morti di §4c).
4. **Skill `testing`** con fixtures + `InMemory<Foo>Repo` (§4a).
5. Poi, con calma, la libreria: `createWithTransaction`, `Page<T>`, i port
   ricorrenti, la guida `DomainError → TaggedError` (§5).
