# Blueprint: punti aperti al 30 ottobre 2026

Stato del branch `docs/32-skill-blueprint` a fine sessione. Il documento di
riferimento resta `blueprint/index.html` (registro fino al giro 14); il deck è
in `blueprint/deck/`. Qui stanno solo le cose **non decise o non fatte**, da
riprendere prima di riscrivere la skill.

## Aggiornamento del 6 novembre (giro 15)

Decisi in sessione, registrati nel documento (§0, §3, §8, §9, §10, registro):

- **`better-result` al posto di Effect** per `Result` ed errori con tag, zod 4
  al bordo. Condizione: provarlo prima su `example/2c-bus`, dove costa di più
  (gli errori sul canale HTTP non sono più schemi: serve un helper in
  `commands` che li ricostruisce dal `_tag`). Se l'helper resta piccolo, si
  riportano gli altri gradini e `@efesto-cloud/usecase`.
- **Test in sei livelli**, ciascuno con la regola sul «quanto» (§3): dominio,
  use case (un test per ogni errore della `Error` union), contratto delle
  porte, boot, contratto del bus, end-to-end, più i test di tipo.
- **Fake e suite di contratto in `core/testing`**; `stub-adapter` si riduce a
  un modulo che li lega. Chiude il punto 3 qui sotto.

Ancora aperta la Q11 (punto 1). Proposte non ancora discusse: dividere il
branch in tre PR da `main` (librerie, esempio, skill); provare la skill con
un agente su un progetto vuoto prima di chiamarla definitiva.

## Aggiornamento del 6 novembre (giro 16)

Dal confronto con `efesto-cloud/agent` (ADR 0002), primo progetto sul 2·C:

- **Fuori è un'API, dentro un bus**: `bus-server` → `api`, `api.dispatch`,
  `/api/<comando>`. `bus` resta il nome del pacchetto interno.
- **L'api parla un solo canale interno** (è il vecchio bus-server senza
  l'HTTP). Intorno: **gateway**, che espongono l'API in un protocollo
  (HTTP/JSON, GraphQL, JSON-RPC, MCP) traducendo uno a uno, e **client**, che la
  consumano: direttamente se girano dentro la piattaforma, da un gateway se no.
  Router opzionale, solo per un dominio unico. Nessun gradino nuovo. Protocollo
  fuori dal dispatcher: principio; worker a sé: preferenza.
- **Q11 chiusa**: policy per use case in `core/src/auth/policies.ts`.
- **Migrazione di `agent`** da Effect a `better-result`: sì, dopo la prova su
  `2c-bus`.
- **D1 e unit of work: parcheggiato.** D1 non ha transazioni interattive.
  Proposta sul tavolo: `batch()` alla fine, senza rileggere le proprie
  scritture. Non discussa.

Da fare nell'esempio: rinominare `packages/bus-server` in `api`, aggiungere un
gateway HTTP separato. Le figure del «quadro completo» e del §1 (scheda
2·C) mostrano ancora i canali dentro il bus-server: da ridisegnare con gateway e client.
Il deck (`blueprint/deck/`) va allineato ai giri 15 e 16.

## Prova di better-result su 2c-bus (6 novembre)

Riuscita, sul branch `spike/better-result` (commit `6144c35`). `2c-bus` gira
su `better-result` + zod senza Effect: typecheck e test verdi (core 6, bus 12,
bootstrap 3, scenario 11×3). Gli altri gradini su quel branch non compilano
finché non vengono riportati.

- **Errori**: `taggedError(tag, shape)` nel core dà la classe di better-result e
  il suo codec zod (`z.codec`). Sul canale passano solo `_tag` e i campi
  dichiarati; un `_tag` non dichiarato o un campo sbagliato è rifiutato.
  Costo: 63 righe (`taggedError`) + 39 (`resultCodec` in `commands`).
- **Lo stack arriverebbe al client**: `toJSON()` di better-result lo include.
  L'helper non lo usa.
- **Una garanzia si è persa in silenzio** con la prima versione dell'helper
  (tipi degli errori vuoti: l'handler che non combacia compilava). Trovata solo
  rompendola apposta: servono i test di tipo (§3).
- **Il codec va costruito su `this`** nel metodo statico, non sulla classe base,
  altrimenti `instanceof` fallisce dall'altra parte. `biome --unsafe`
  (`noThisInStatic`) lo rompe: c'è un `biome-ignore` con la spiegazione.
- **pnpm 12.5**: il ciclo `core` ↔ `stub-adapter` è un errore, non un warning;
  `pnpm -r typecheck` non parte. Spostare i fake in `core/testing` è urgente.
- `pnpm -s typecheck` nasconde l'output di tsc: vale solo il codice d'uscita.

Da decidere: `taggedError` come template in `stack/` o come pacchetto di `lib`
(proposta: pacchetto); poi riportare gli altri gradini e `agent`.

## Giro 17 (8 novembre)

Registrato nel documento, sezione «La forma» con tre figure:

- **Prototipo**: forma leggera, usa e getta ma in ordine; etichettato `poc-`.
- **Standard** = 1 + 2·A: uno spettro su dove stanno le implementazioni (nel core
  o in adapter); la porta c'è sempre.
- **Bootstrap condiviso** e **API**: estensioni con il loro segnale, non gradini.
- **`contract` + `core`**: il contract è il bordo verso i driver (DTO, schemi
  degli input, errori, interfacce degli use case, registro, metadati dei
  comandi, regole pure) e assorbe `commands`. Le porte driven restano nel core
  perché parlano di entity.
- **Comando = use case esposto**, stesso nome: gli handler spariscono.
- **Niente barrel**; registro composto, senza `declare module`.

**Decisi la sera dell'8 novembre** (registrati nel documento, giro 17):

1. **Esposizione**: nessun segno nel contract; cosa esporre lo decide ogni
   gateway (MCP, API li scriviamo noi). La policy `internal` resta la guardia
   nell'api.
2. **Contesto d'esecuzione**: parametro generico di `IUseCase`
   (`IUseCase<I, R, C>`), con `ExecutionContext` e l'alias `UseCase<I, R>` nel
   contract. Niente `declare module`. `AsyncLocalStorage` per la transazione
   dell'unit of work (per richiesta), non per l'attore.
3. **Errori**: nel contract se compaiono nella `Error` di uno use case (lo
   impone il compilatore, il contract non dipende dal core); gli errori di porta
   gestiti dallo use case restano nel core; i guasti dell'infrastruttura sono
   eccezioni e al bordo diventano `InternalError`. Sempre `TaggedError`.
4. **`taggedError`**: nel contract del progetto; in `lib` solo se più progetti
   lo copiano identico.
5. **Prototipo**: un pacchetto solo, senza divisione in cartelle.


**Poi:** provare il giro 17 su `example/2c-bus` nel branch
`spike/better-result` (contract, niente handler, niente barrel, registro
composto); poi riscrivere §1, §5 e «Il quadro completo», e ridurre l'esempio a
tre cartelle.

## Fatto

- `example/` completo, dal gradino 0 al 2·C: `pnpm example` fa girare
  typecheck e test di tutti i gradini, e sono verdi. README in `example/README.md`.
- `@efesto-cloud/usecase`: `IUseCase<I, R extends Result>` (Result di Effect; da portare su `better-result`),
  tolto il campo `name`.
- `@efesto-cloud/unit-of-work`: `runWithTransaction` riceve e ritorna un
  `Result` e fa rollback anche quando lo use case fallisce.
- `audit` rimosso dal repo.
- Documento: sezione «Il quadro completo», §10 con quello che l'esempio ha fissato.
- Deck di 22 slide, con le slide dei gradini animate (Auto-Animate).

## Da decidere

1. ~~**Q11, dove si dichiara la policy.**~~ Chiusa il 6/11: mappa nel core. L'esempio propone una mappa nel core
   (`core/src/auth/policies.ts`), una policy per use case. Il tipo richiede ogni
   chiave del registro, quindi uno use case senza policy non compila. Gli use
   case interni hanno la policy `internal`. Il comando non porta la policy:
   chi la cerca la trova nello snapshot comando → use case → policy. Il
   documento nei §5–6 mostra ancora `policy: can(...)` dentro il comando:
   allinearlo quando si decide.
2. **Changeset** per `usecase` e `unit-of-work`, cambi incompatibili con le
   versioni pubblicate. Non generati.
3. ~~**Ciclo `core` ↔ `stub-adapter`**~~ deciso il 6/11: fake e suite di
   contratto in `core/testing`, lo stub li lega soltanto. Da fare nell'esempio.
4. **Gli altri pacchetti da ritirare** (`result`, `result-async`, `maybe`,
   `maybe-async`, `tagged-error`, `result-codec`, `prisma-*`, `mongodb-*`,
   `login-session`): decisi nel §9 ma ancora nel repo. Quando e come
   toglierli; `npm deprecate` per questi e per `audit`.
5. **`toast` ed `env`**: da riallineare (§9), non toccati.
6. **Scelte dell'esempio da confermare o no come regole**: webapp come
   funzioni `Request → Response` al posto di React Router; pacchetti che
   esportano i sorgenti senza build; `node:sqlite` come database; lock sulle
   transazioni in `Database.exclusive`; attore del job = chi l'ha accodato.
7. **Template `stack/prisma`** per unit of work rientrante ed expand, con il
   test di concorrenza promesso nel §3: non scritto.

## Da fare

- Riscrivere `plugins/blueprint/skills/blueprint/SKILL.md` e le references
  (struttura nella Q18 del documento) prendendo gli snippet da `example/`.
- Rimuovere le skill figlie (`entity`, `usecase`, `value-object`, …) dal plugin.
- Avvisi di densità del deck (slide 8, 9, 18, 19 sopra le 70 parole; 11 con
  8 voci), lasciati di proposito.
- Aprire la PR del branch (base `main` del repo `lib`) quando la skill è riscritta.
  Il branch è impilato su `feat/tagged-error-and-combinators` (PR #31), che non
  si fonde: va ribasato su `main` prima della PR.
