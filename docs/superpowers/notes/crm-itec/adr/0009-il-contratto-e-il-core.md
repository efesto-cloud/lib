---
status: accepted
---

# Il contratto e il core: due pacchetti, better-result e un registro composto

Il core (vedi [0002](0002-dominio-in-core-con-architettura-esagonale.md)) era
nato su `@efesto-cloud/result` e `@efesto-cloud/usecase`, con gli errori
figli di `DomainError` e un registro degli use case che ogni modulo estendeva
con `declare module`. Le route React importavano da `@itec/core`, e il canale
sonda → Worker si validava a mano. Il core era ancora piccolo, ed era il
momento in cui cambiarne la forma costava poco: lo si è fatto prima dei passi
delle pratiche, che nascono già così.

La decisione ha quattro parti.

**Due pacchetti.** `@itec/contract` è quello che vedono i chiamanti: le
interfacce degli use case con gli schemi dei loro input, le interfacce di ciò
che esce (`interface/`), i tipi e gli enum, gli errori, `UseCase<I, R>`,
`ExecutionContext`, il registro, e il canale della sonda (gli schemi zod dei
payload di `/api/sonda/*` e il formato della firma). Non dipende dal core.
`@itec/core` importa il contract e tiene il resto: entità, porte (che parlano di
entità), implementazioni degli use case, e l'install che le carica su un
container. Il container non è del core: lo crea ogni composition root (la
webapp, la sonda, il seed, un test), che ci lega i suoi adapter. Le parti React
della webapp (`app/routes/**/*.tsx`) importano solo dal contract; il Worker, i
moduli `.server.ts` e la sonda, che esegue lei i suoi use case
([0006](0006-un-core-solo-anche-per-la-sonda.md)), anche dal core. Fa
eccezione `core/src/rule/`, le regole pure senza dipendenze: una parte React
può importarle quando lo stesso calcolo deve girare nel browser mentre si
scrive e nello use case al salvataggio, come il ricalcolo della manodopera
(#82). Così la regola resta una sola. Nessun
barrel: ogni pacchetto esporta `"./*"` e si importa per percorso.

**better-result e gli errori con tag.** `Result` viene da `better-result`, con
la versione esatta: ha un solo maintainer e ha già avuto tre major. Gli errori
sono `TaggedError` nella forma di better-result, `class XError extends
TaggedError("XError")<{ campi }> {}`, senza schemi né codec. Il tag è il nome
della classe, e l'interfaccia traduce i messaggi per tag. Come un errore viaggia
su un mezzo (un'API HTTP, per esempio) lo decide chi lo espone, con la sua
codifica, quando serve: non il contract. Un errore sta nel contract se compare
nella `Error` di uno use case; nel core se è l'errore di una porta che lo use
case gestisce (`ArcaReadError`); i guasti dell'infrastruttura sono eccezioni.
`UseCase<I, R>` è nel contract, in poche righe; `ExecutionContext` è uno per
tutta l'app, ed è vuoto finché un ticket non lo riempie. Il primo a riempirlo è
l'utente che agisce ([0012](0012-l-accesso-con-un-jwt-firmato.md)).

**Il registro composto.** Ogni modulo ha un tipo con i suoi use case per
chiave (`ArcaUseCases`), e `registry.ts` li compone. Nel core ogni modulo ha
un'implementazione per chiave, e il container le lega tutte: una chiave che non
c'è, un use case senza implementazione o un modulo dimenticato non compilano.
La chiave è anche l'identificativo nel container.

**Ciò che entra è uno schema, ciò che esce un'interfaccia.** L'input di uno use
case è uno schema zod nello stesso file della sua interfaccia, con lo stesso
nome per lo schema e per il tipo che se ne ricava (`CreateUtenteInput`). Lo
passa dallo schema chi chiama, al bordo, solo dove entra un dato grezzo: il
`FormData` di un'action, i parametri di una richiesta, il JSON della sonda; un
input che non lo rispetta è un 400. Dove il valore è già tipizzato (l'utente
della sessione, le costanti del seed) non si rivalida, e lo use case non
rivalida la forma: tiene solo le regole del dominio, con i loro errori. Ciò che
esce è un'interfaccia TypeScript in `interface/`, `I<Entità>` per un'entità e
`I<Nome>` per una riga che esce (`ISyncLogEntry`): la produce il nostro codice,
e un controllo in runtime non proteggerebbe niente. `type/` tiene le union e le
struct semplici. Il canale della sonda resta di schemi: per il Worker è un
ingresso.

## Cosa resta fuori del blueprint di `efesto-cloud/lib`, e perché

- **L'attore e le policy per use case**: arrivano con la matrice dei permessi.
  L'attore è arrivato col JWT, in [0012](0012-l-accesso-con-un-jwt-firmato.md),
  e le policy con [0013](0013-permessi-per-azione-e-policy-nel-resolver.md).
- **Bus, `api.dispatch`, gateway, bootstrap condiviso**: c'è una webapp sola, e
  il segnale che li giustifica non c'è.
- **`kind` e `description` negli spec degli use case**: nessun canale li chiede.
- **L'unit of work su D1**: è arrivata dopo, con
  [0011](0011-il-patto-del-save-e-la-unit-of-work.md).
- **`@efesto-cloud/usecase`**: `UseCase<I, R>` sono tre righe nel contract, e il
  campo `name` non serviva a nessuno.

## Le conseguenze che vale la pena conoscere

- **Un container per composition root**: chi lo crea lo installa e ci lega gli
  adapter. La sonda e il Worker sono due container anche in un test che li fa
  parlare (`webapp/test/sonda.test.ts`): uno solo legherebbe le porte dei due
  lati insieme, e nasconderebbe quello che in produzione manca.
- **Il contract si compila in `dist/`** come il core, e prima del core: la sonda
  gira su Node, che non toglie i tipi dentro `node_modules`. L'immagine della
  sonda copia anche `packages/contract`, e il suo workflow lo guarda.
- **I messaggi d'errore dell'interfaccia** (`webapp/app/errori.ts`) sono un
  oggetto tipizzato sugli errori degli use case di `accesso` e `utenti`: un
  errore nuovo senza messaggio, o un messaggio rimasto senza errore, non
  compila.

## Come si aggiunge

- **Un use case** del modulo `m`: in `contract/src/useCase/m/I<Nome>.ts`
  l'interfaccia con la sua `Error` e, nello stesso file, lo schema dell'input,
  `export const <Nome>Input = z.object(…)` con `export type <Nome>Input =
  z.infer<typeof <Nome>Input>`; una riga nel tipo del modulo (`<M>UseCases.ts`);
  l'implementazione in `core/src/useCase/m/impl/` e una riga in `<M>Module.ts`.
  Una parte d'input comune a più use case è uno schema a sé accanto a loro
  (`DatiUtente`).
- **Ciò che esce per un'entità**: `contract/src/interface/I<Entità>.ts`, una
  `interface`, senza suffisso `Dto`.
- **Un errore**: `class <Nome>Error extends TaggedError("<Nome>Error")<{ campi
  }> {}` (senza campi, `TaggedError("<Nome>Error") {}`; `cause?: unknown` fra i
  campi se ne porta una), in `contract/src/errors/` se compare nella `Error` di
  uno use case, nel core se è l'errore di una porta. Se lo vede l'utente, il suo
  messaggio va in `errori.ts`.
- **Un modulo**: il tipo `<M>UseCases.ts` nel contract e una riga in
  `registry.ts`; `<M>Module.ts` nel core e una riga in `di/install.ts`. Se i
  suoi errori arrivano all'utente, il modulo entra in `ErroreMostrato`.

Decisione dell'11 novembre 2026, rivista lo stesso giorno con #88: gli input
come schemi, le uscite come interfacce, gli errori nella forma di better-result
e il container nelle composition root.