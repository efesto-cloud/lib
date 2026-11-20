# Blueprint: estensioni e job (archiviato, da definire)

**Fuori dalla versione definitiva** (`forma-definitiva.html`) per decisione del
20/11/2026: nessuno dei due progetti reali ha ancora la forma che il documento
di lavoro descriveva. Qui c'è tutto quello che si era deciso, provato e
osservato, perché non vada perso. Non è una regola della skill.

Fonti: documento di lavoro (`index.html`, §1 gradini 2·B e 2·C, §5, §7, «Il
quadro completo», giri 3–17), `../2026-10-30-blueprint-punti-aperti.md`, agent
(`efesto-cloud/agent`, ADR 0002, 0003, 0005, `dev` a a29add8), CRM ITEC
(`thera-capital/crm-itec`, ADR 0006, 0009, `dev` a 90e4997), confronto del
20/11/2026.

## Il bus: quello che si vuole catturare (DF, 20/11)

Il **bus** è il modo unico di chiamare uno use case fra due componenti nostri:
`dispatch(chiave, input)` che restituisce un `Result`. La comunicazione è una
**porta**, e il **canale** è il suo adapter: in-process, Workers RPC, HTTP
interno. Cambiare canale non tocca né chi chiama né chi esegue. È lo stesso
principio delle porte del core, applicato alla comunicazione interna.

Per questo il nome giusto è «bus» e non «API»: «API» porta verso un'API HTTP
pubblica, che è un'altra cosa.

| | canale del bus | gateway |
|---|---|---|
| fra chi | due componenti nostri (webapp ↔ chi possiede i dati) | noi ↔ il mondo esterno |
| forma | adapter intercambiabili: in-process, Workers RPC, HTTP interno | un protocollo pubblico: HTTP/JSON, GraphQL, JSON-RPC, MCP |
| contratto | nostro, privato, cambia insieme ai due lati | pubblico: cosa esporre e come codificare gli errori lo decide il gateway |

Un HTTP interno usato come canale e un'API HTTP pubblica sono cose diverse
anche se il protocollo è lo stesso.

**Da decidere:** il nome del deployable che possiede i dati. Al giro 16 era
diventato `api` (da `bus-server`); scartato il 20/11 per il motivo sopra.

## Cosa si era deciso nei giri (documento di lavoro)

- **Segnale**: il secondo client sugli stessi dati, oppure un client che non
  deve possedere i dati (CLI, MCP, client non JS). Prima formulazione: «il
  secondo client che riscriverebbe le regole d'accesso» (legata
  all'autorizzazione, vedi `autorizzazione.md`).
- Il deployable che possiede i dati: possiede dati e segreti, valida l'input,
  esegue; parla un solo canale interno e non vede mai una `Request`.
- **Comando = use case esposto**, stesso nome: `dispatch("expenses.ApproveExpense")`,
  niente handler (giro 17). Rinominare uno use case esposto è un cambio
  incompatibile.
- Lo schema dell'input è quello del contract; il dispatcher valida prima di
  eseguire, anche sul canale in-process. Un input non valido non arriva allo use case.
- **Middleware**: solo generici (audit, logging), applicati una volta da chi
  costruisce il dispatcher.
- **Gateway**: espone l'API in un protocollo, traduce uno a uno, senza logica.
  Decide lui cosa esporre (giro 17). **Client**: consuma l'API per sé (webapp,
  CLI, consumer dei job); direttamente se gira dentro la piattaforma, da un
  gateway se no. Un client che finisce per inoltrare soltanto è un gateway.
- **Router**, opzionale: possiede l'hostname e smista per percorso, senza logica.
- Principio: ogni protocollo sta fuori dal dispatcher. Preferenza: su Cloudflare
  ogni gateway è un worker a sé con un service binding.
- Il bus è sempre una chiamata con risposta: non ha una coda.
- I client importano il contract (e le regole pure), mai use case, container e adapter.

## Bootstrap condiviso

- **Segnale**: il secondo processo sullo stesso core (consumer, cron, seconda webapp).
- Il wiring esce in un pacchetto `bootstrap`, con un **profilo per processo**
  che carica solo gli adapter che gli servono; mock e reale si scelgono lì.
- Al boot: variabili d'ambiente mancanti (`MissingEnv`), use case che un profilo
  non può servire (`UseCaseUnavailable`).

## Job, coda e cron

- Il lavoro differito passa da una porta del core; coda e scheduler sono
  adapter, con il loro stub.
- Il bus non sostituisce la coda, e la coda non sostituisce il bus.
- Chi esegue un job chiama lo use case, che non sa di girare in differita.
- Fuori dal blueprint finché non c'è una soluzione provata: dove girano consumer
  e scheduler, retry, parallelismo, repliche, idempotenza, attore dei job.
- `outbox` (pacchetto di lib) sospeso insieme ai job.

## Test previsti per le estensioni

- **Boot**: uno per profilo, più i casi d'errore.
- **Contratto del bus**: lo stesso test sul canale in-process e su quello remoto.

## Cosa fanno davvero i progetti (confronto del 20/11)

**agent** (ha il bus; in parte ancora su Effect, migrazione a better-result prevista):

- `dispatch(nome, input, token)`, tre parametri; il client lega il token alla
  creazione (`rpcBus(endpoint, token)`, `inProcessBus(dispatcher, token)`).
- Comandi con un **nome diverso** dallo use case (`listMeetings` →
  `"meetings.ListMeetings"`) e un handler per comando
  (`packages/bus/src/handlers/index.ts`). `/api/<comando>` accetta solo
  `[A-Za-z]+`. Non dipende da Effect.
- Contratto in `packages/commands`, separato dal core: `kind`, `description`,
  `input`, `output`, `errors` per comando. [Effect] per schemi e output. Il CRM
  ha tolto `kind` e `description` perché nessun canale li chiedeva.
- Sul canale un involucro Result: `{ _tag: "Success", value }` /
  `{ _tag: "Failure", failure: { _tag, …campi } }` [Effect]. Workers RPC clona i
  dati e un errore arriverebbe come oggetto qualunque: da qui gli schemi
  d'uscita e il codec (ADR 0002). Con better-result la cosa va ridecisa.
- Errori del bus: `InvalidInput` (anche per un comando sconosciuto) e
  `InternalError`; un errore non dichiarato o un'eccezione diventano
  `InternalError` senza dettagli.
- Ogni esito è un 200 con un Result; 404/405/415 solo per il protocollo. La
  webapp traduce in 401/403/400/500 e i `*NotFound` in 404.
- Gateway HTTP che passa il JSON così com'è; gateway MCP che espone un
  sottoinsieme in sola lettura, con nomi suoi e un output rimodellato (non è
  «uno a uno»). Eccezione binaria `PUT /api/uploadSourcePart` per i limiti del
  canale (RPC 32 MiB, richiesta Worker 100 MB).
- Middleware: l'aggancio c'è, nessuno lo usa.
- Un client in-process dentro il deployable: l'agente dell'incontro chiama gli
  use case dal bus in-process (ADR 0005).
- Bootstrap senza profili, solo `MOCK`; gli adapter veri li passa il worker.
  `UseCaseUnavailable` alla risoluzione, non al boot; nessun controllo delle
  variabili.
- Job: Workflows e un Durable Object dell'Agents SDK; il workflow chiama dei
  **process**, non use case («nessuno la chiama dal bus, e non ha un attore»),
  con idempotenza in `enqueue` e retry nel passo. Porte per lavoro
  (`ITranscriptionQueue.enqueue(job_id)`), non tipizzate sul registro.
- Test: una suite di contratto del bus di 8 scenari su tre canali (in-process,
  rpc, http), `node:test` + `tsx`. Barrel in `core`, `bus`, `commands`.

**CRM ITEC** (forma standard, senza bus):

- Due processi sullo stesso core (webapp sui Worker e sonda su Node, a orario,
  ADR 0006), ma ognuno con la sua composition root e nessun bootstrap: «il
  segnale non c'è perché c'è una webapp sola» (ADR 0009). Il controllo delle
  variabili al boot c'è, nella sonda (`exitWith`).
- La sonda parla col Worker su un canale HTTP firmato (HMAC), con gli schemi zod
  dei payload nel contract: un secondo processo **senza bus**, alternativa che
  il documento non nominava.
- Il cron della sonda è `croner` nella composition root, senza porta; chiama
  `resolveUseCase("arca.SyncArcaToCloud")`.
- In un test che fa parlare sonda e Worker restano due container.

## Domande aperte

1. Nome del deployable che possiede i dati.
2. Comando = use case con lo stesso nome (giro 17) o comandi con nome proprio e
   handler (agent)?
3. Come viaggiano esiti ed errori su un canale che clona (Workers RPC) con
   better-result: codec per use case, `{ _tag, …campi }`, o interfacce senza
   runtime come nel CRM?
4. Il token: parametro di `dispatch` o legato al canale?
5. Profili del bootstrap: servono, o basta `MOCK` più gli adapter passati dal
   processo?
6. Il lavoro senza attore: use case con un attore di sistema, o «process» del
   core fuori dal registro?
7. Porta della coda tipizzata sul registro o per lavoro?
8. Il secondo processo che parla su un canale firmato (CRM) è un caso del bus o
   una forma a sé?
