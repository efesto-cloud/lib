# Blueprint: autorizzazione (archiviato, da definire)

**Fuori dalla versione definitiva** (`forma-definitiva.html`) per decisione del
20/11/2026: le idee non sono ancora chiare. Qui c'è quello che si era scritto e
provato fino ad allora, perché non vada perso. Non è una regola della skill.

Fonti: documento di lavoro (`index.html`, §2, §6, giri 11–17), CRM ITEC
(`../crm-itec/adr/0012`, `0013`, `0014`, `issue/93.md`, `issue/94.md`, codice in
`../crm-itec/codice/packages/core/src/auth/`).

## Su cosa si era d'accordo

- **Gli use case non fanno autenticazione né autorizzazione.** Usano l'attore
  come dato (l'autore, chi approva), non per decidere i permessi.
- **Criterio fra policy e dominio:** se la risposta dipende da chi è l'attore
  rispetto alla risorsa (ruolo, appartenenza, possesso) è una policy; se dipende
  dallo stato della risorsa è dominio. «Solo l'autore invia la nota» è policy,
  «solo se è in bozza» è dominio.
- **L'attore viaggia nel contesto d'esecuzione** (`execute(input, ctx)`), non in
  `AsyncLocalStorage`.
- **Una policy per use case, obbligatoria**, in una mappa nel core
  (`core/src/auth/policies.ts`), tipata sul registro: uno use case senza policy
  non compila. Scartati i default: «nega se manca» sposta l'errore a runtime,
  «consenti se manca» lascia buchi silenziosi.
- **Snapshot versionato** use case → policy: ogni permesso cambiato si vede nel diff.

## Chi applica la policy: due forme, mai riconciliate

**Documento di lavoro (giri 11–17).** Le regole le conosce il core; chi le
applica cambia con la forma. Fino al bootstrap condiviso è ogni webapp, rotta
per rotta, senza un meccanismo unico che lo imponga. Con l'API le applica il
middleware del bus, una volta per tutti i client, ed era uno dei segnali per
salire. Nessun accesso anonimo: il bus si apre solo con un token valido.

**CRM ITEC (ADR 0013, provato).** Le applica **il resolver**, a ogni livello:

- la policy è una classe `@injectable()` che estende `Policy`, con
  `check(target, ctx)`, e si fa iniettare le repository che le servono;
- `.on((i) => i.codice)` ne fa la versione per un input preciso, così da dove si
  prende la risorsa è scritto accanto allo use case;
- `useCaseModule` lega, accanto alla chiave, un oggetto che si fa iniettare lo use
  case e la sua policy nello stesso request scope: la policy vede la stessa Unit
  of Work dello use case;
- il tipo del resolver (`Guarded<U>`) aggiunge `NotAllowedError` agli errori di
  ogni use case;
- uno use case iniettato da un altro use case non passa dalla policy: si
  controlla chi chiama da fuori;
- una risorsa che non esiste: la policy lascia passare, lo use case risponde col
  suo `NotFoundError`.

Scartati nel CRM: il controllo nelle rotte (ognuna deve ricordarselo), un
`onActivation` di Inversify (avvolge anche gli use case iniettati, e non si vede
nel codice), una mappa di funzioni (le policy vogliono le repository).

## Policy con un nome fisso

- `AnyMember` / `AnyUtente`: c'è un utente autenticato, niente di più.
- `Anyone`: nessun utente; l'autenticazione la fa il bordo (login, firma HMAC
  di un canale). Nel CRM esiste; nel documento di lavoro «nessun accesso
  anonimo». Da riconciliare.
- `Internal`: nega sempre da fuori; per gli use case chiamati solo da altri use
  case o dai job.

## Il modello dei permessi (CRM ITEC, ADR 0013 e 0014)

Ruolo × azione → sì/no. I ruoli sono fissi nel codice, l'amministratore è un
flag; la matrice sta nel database e la cambia l'amministratore; il catalogo
delle azioni sta nel contract. La fase in cui un'azione è ammessa è dominio. Si
guarda sempre una cella sola. È una scelta di quel progetto, non del Blueprint.

## Domande aperte

1. Chi applica la policy: il resolver (CRM) o il middleware dell'API (documento
   di lavoro)? Con il resolver l'API non aggiunge niente sui permessi, e il
   segnale «il secondo client che riscriverebbe le regole d'accesso» per salire
   all'API perde forza.
2. Policy come classi iniettabili o funzioni pure? Le classi servono quando la
   policy carica la risorsa; costano un pezzo di DI in più.
3. `Anyone` sì o no; e come si dichiara che l'autenticazione la fa il bordo.
4. Identificare l'attore da una credenziale (sessione, token) è un servizio del
   core o del bordo?
5. L'attore dei job: chi l'ha accodato, o un attore di sistema?
6. Dove sta il catalogo delle azioni, e se il Blueprint deve dire qualcosa sul
   modello dei permessi o lasciarlo del tutto al progetto.
