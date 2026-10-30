# Skill `blueprint` — recap prima della revisione

Dal giro 2 in poi il documento di riferimento è `blueprint/index.html`: lì stanno le decisioni aggiornate e il registro dei giri. Questo file resta come traccia del giro 1.

Stato al 2026-10-30. Questo è un registro di lavoro: serve a rivedere insieme il
disegno prima di riscrivere le references.

## Fonti

- **Il target**: mappa `thera-capital/gestionale#373`: API come command bus tipizzato,
  `api` (contratto) + `api-server` (operation, decorator, policy obbligatoria), use
  case senza suffisso. Figure in `gestionale/docs/architettura/api-operation/`.
- **La discussione**: `efesto-cloud/lib#32` più il commento del 24 ottobre, che
  sostituisce il punto 4: due assi di modularità, i gradini A/B/C con il segnale
  per salire, `adapters/`, `bootstrap`, `core/client`, `execute(input, { actor })`.
- **Il corpus**: `2026-08-23-analisi-corpus-progetti.md`, cinque progetti misurati:
  il plugin contiene due generazioni che si contraddicono; `@audit` è morto; mancano
  i test e il pattern plan/apply; la module augmentation collassa a `never` (oss. 23).
- **L'handbook**: `tecnica/architettura-software`, lo spettro della modularità (asse 1)
  e il `[!da-dettare]` «quando serve un'API separata» (risposta: gradino C).

## Già deciso

| Tema | Decisione |
|---|---|
| Nome | `blueprint` (plugin e skill) |
| Skill figlie | assorbite: una skill sola con `references/`, le figlie spariscono |
| Lingua | inglese |
| Branch | `docs/32-skill-blueprint`, impilato su `feat/tagged-error-and-combinators` (PR #31) |
| Modifiche del 23 agosto non committate (`@audit` e `@withTransaction` tolti) | portate sul branch |

Fatto finora: `plugins/core` → `plugins/blueprint`, manifest aggiornato, prima bozza
di `SKILL.md` (i due assi, cosa tiene aperto il gradino dopo, la forma a regime, le
regole, la ricetta in 13 passi, l'indice). Va rivista anche quella.

## Struttura proposta delle references

- **Forma e crescita**: `growth.md` (nuovo), `architecture.md`, `folder-structure.md`,
  `conventions.md`
- **Dominio**: `entity.md`, `value-object.md`, `type-enum-dict.md`, `dto.md`, `errors.md`
- **Applicazione e wiring**: `usecase.md`, `repository-port.md`, `service-port.md`,
  `di-layer.md`, `composition-root.md`, `api.md` (nuovo), `testing.md` (nuovo),
  `feature-walkthrough.md`
- **Persistenza**: `prisma-persistence.md`, `expand.md`, `prisma-expand.md`
  (`population` → `expand`, come nella PR #26)
- **Valori e reattività**: `result.md`, `maybe.md`, `result-codec.md`, `publisher.md`,
  `observer.md`. **Dipende dalla decisione su Effect.**

## Esempi dal gestionale

Indicazione del 30 ottobre: serve la vista d'alto livello (come si scrive uno use case,
contesto, `resolveUseCase`, autorizzazione, decorator e chiamante come nella mappa
#373), non i pattern di dettaglio come il plan/apply di Paprika.

Candidati, tutti codice vero:

- `bootstrap/src/index.ts`: `getResolveUseCase(env, { mock, requires })`, mock o reale,
  errori con nome per i binding mancanti, rollback del container se il boot fallisce
- `core/src/client.ts` contro `core/src/server.ts`: l'uscita sicura per il browser e
  quella server
- `core/src/executionContext.ts`: l'augmentation di `IExecutionContext` con `actor`
- `server.ts` con gli import nudi dei moduli: la soluzione all'oss. 23, mai scritta
- `_testing/fixtures.ts` e `InMemory<Foo>Repo`: il fake come oracolo della porta
- `PraticaStatusChange`: lo storico come artefatto di dominio, non come decoratore
- `Pratica.create`: campi obbligatori, factory che ritorna `Result`
- `entity/praticaStateMachine.ts`: macchina a stati pura, condivisa col client
- `adapters/*/install`: un `ContainerModule` per adapter

**Attenzione: `efesto-cloud/lib` è pubblico**, il gestionale è codice di un cliente.
Gli esempi vanno presi come *forma* e rinominati su un dominio neutro. Oppure il
progetto esempio (sotto) diventa la fonte degli esempi.

## Da decidere

### 1. Effect al posto di `result` / `maybe` / `tagged-error`

L'idea è smettere di reinventare `Result` e gli errori taggati e usare Effect, che gli
agenti conoscono meglio. Il nodo è **fin dove**, perché le due strade cambiano skill
diverse:

- **Effect solo come libreria di valori**: il risultato di Effect e `Data.TaggedError`
  al posto di `Result` / `DomainError`, `Schema` al posto di zod e di `result-codec`.
  Inversify, use case con `execute(input, ctx)`, porte e adapter restano come sono.
  Cambiano `result`, `maybe`, `errors`, `result-codec`, gli esempi di tutte le
  references e il contratto dell'API.
- **Effect come runtime**: gli use case diventano `Effect<A, E, R>`, le porte sono
  `Context.Tag`, gli adapter sono `Layer`, e Inversify, `UseCaseRegistry` e `bootstrap`
  lasciano il posto alla composizione dei layer. `@effect/rpc` si sovrappone al
  command bus di #373. È un'altra skill, quasi per intero.

Domande collegate:

- Quali pacchetti di lib vanno in pensione: `result`, `result-async`, `maybe`,
  `maybe-async`, `tagged-error`, `result-codec`, e forse `usecase` ed `env`?
  Quali restano: `entity`, `expand`, `unit-of-work`, `observable`, …?
- I progetti che usano il `Result` nostro, il gestionale per primo: restano così e
  Effect vale solo per i progetti nuovi, oppure migrano a poco a poco?
- La PR #31 (tagged-error e combinatori): se si va su Effect conviene ancora fonderla?
  Se no, questo branch non dovrebbe esserci impilato sopra.
- La skill descrive solo la forma nuova, oppure anche quella vecchia per chi la
  mantiene?

### 2. Il progetto esempio

`lib/example` oggi è un guscio (`@efesto-cloud/usecase` e un `index.ts`). Proposta:
farlo diventare **il target**, cioè il gradino 3 + C su un dominio piccolo e neutro.
Deve compilare, avere i test e girare in mock. Gli snippet della skill si prendono
da lì, quindi sono verificati e non scritti a memoria.

- Dove sta: in `lib/example`, oppure in un repo a sé che diventa anche il template
  (il `[!direzione]` «fissare i template di progetto» dell'handbook)?
- Che dominio usa? Deve avere almeno un'entità con stati, uno storico, un
  import plan/apply e due client con permessi diversi.

### 3. Chi fa cosa: webapp, API, use case (indicazioni di Dario, 30 ottobre)

- **La webapp fa solo la webapp.** Al gradino C non chiama gli use case del core,
  cioè non fa da backend: contatta l'API. Più webapp sulla stessa applicazione, magari
  una per modulo, parlano tutte con **la stessa API**, e così l'autorizzazione si
  scrive una volta sola invece che in ogni webapp.
- **Il trasporto è un dettaglio.** Oggi è Worker to Worker (Workers RPC), domani
  può essere HTTP o un altro RPC. Il contratto (`api`) non cambia; cambia solo
  l'adapter di trasporto.
- **L'autorizzazione sta nell'API**, nella policy del comando.
- **Gli use case non si occupano di autenticazione né di autorizzazione.** Sono use
  case: ricevono l'attore nel contesto e lo usano come dato (per esempio chi crea),
  non per decidere se può.
- **Gli use case si fidano dei tipi.** Non ricontrollano a runtime che l'input sia
  davvero come lo dichiara TypeScript: la forma dell'input la valida il bordo (lo
  schema del comando). Dentro restano soltanto:
  - le regole di dominio (stati ammessi, invarianti, unicità), che stanno in entity
    e value object e ritornano `Result`;
  - i controlli che un campo opzionale richiede.

  Da verificare: `usecase.md` ha oggi una sezione «Validating input» da riscrivere in
  questa chiave.
- **Collegamento con lo spettro della modularità.** Con una sola webapp è lei a
  chiamare direttamente il core e gli use case (gradino A): è la forma più semplice e
  va bene così. Quando le webapp diventano più d'una, le strade sono due:
  - ogni webapp continua a chiamare il core e **reimplementa per conto suo**
    l'autorizzazione e il resto del bordo, cioè la stessa cosa scritta due volte e
    destinata a divergere;
  - si sale al gradino C: **un'API centrale** gestisce l'autorizzazione in un punto
    solo e le webapp passano tutte da lei.

  Il segnale per salire è proprio questo: la seconda webapp che dovrebbe riscrivere
  le stesse regole di accesso.

Domanda aperta: una regola che dipende dall'attore («solo il responsabile può chiudere
la pratica») è autorizzazione, e va nella policy, o regola di dominio, e va nello use
case? Serve un criterio scritto, perché è il caso in cui gli agenti sbagliano.

### 4. Principi e preferenze, separati

Oggi la skill mescola due cose di natura diversa:

- **Principi**, che valgono a prescindere dagli strumenti e cambiano di rado: i due
  assi e i segnali, il core che non conosce tecnologie, ogni dipendenza esterna dietro
  una porta, il repository pattern con l'implementazione in un adapter, lo stub per
  ogni porta, gli use case con input a oggetto e contesto, l'autorizzazione al bordo,
  gli errori come valori, gli use case che non chiamano altri use case.
- **Preferenze di Efesto**, cioè gli strumenti scelti oggi: Prisma (o Drizzle, o
  altro), D1, Cloudflare Workers, React Router, Inversify, `Result` nostro o Effect,
  zod o `Schema`. Si cambiano in un anno senza toccare i principi.

Proposta di forma:

- `SKILL.md` e le references di forma parlano **solo di principi** e mostrano gli
  esempi sulla porta, non sull'ORM;
- le preferenze stanno in una sezione a parte (`references/stack/…`), una pagina per
  strumento, ciascuna con la data della scelta e cosa la sostituirebbe. Cambiare
  ORM vuol dire scrivere `stack/drizzle.md` e mettere `stack/prisma.md` in pensione,
  non riscrivere la skill.

### 5. Il codice per ORM esce dalle librerie

`lib` oggi ha un pacchetto per ogni combinazione di concetto e database:
`prisma-unit-of-work`, `mongodb-unit-of-work`, `prisma-expand`, `mongodb-expand`, il
contesto del database, la paginazione. Ognuno è poco codice di colla, e ogni ORM nuovo
ne moltiplica il numero. Due dei quattro hanno adozione zero (nota del 23 agosto).

Proposta: quel codice **lo scrive il progetto, dentro il suo adapter**, partendo da un
template nella pagina `stack/<orm>.md` della skill. Un agente lo genera in pochi
secondi, il progetto lo possiede e lo adatta senza aspettare una release di `lib`.

In `lib` resta soltanto ciò che è **contratto condiviso e indipendente dal database**,
e solo se più di un progetto lo usa davvero: per esempio l'interfaccia `IUnitOfWork`,
o i tipi di `Expand`, ammesso che non vadano anch'essi nel template.

Il rischio è che ogni progetto si porti dietro una copia leggermente diversa. Il
progetto esempio lo contiene: i template della skill si prendono da lì e lì sono
compilati e testati.

Da decidere: quali pacchetti vanno in pensione con questo criterio. È la stessa lista
della domanda su Effect vista dall'altro lato, quindi conviene deciderle insieme.

### 6. Fuori o dentro

Dalla nota del 23 agosto restano: `Page<T>` / `PageQuery` / `DeletedFilter`, un
`@efesto-cloud/ports` con le interfacce ricorrenti (mailer, auth, queue),
`createWithTransaction`, la pulizia delle directory residue. Proposta: fuori da
questo giro, salvo quello che la decisione su Effect si porta dietro.
