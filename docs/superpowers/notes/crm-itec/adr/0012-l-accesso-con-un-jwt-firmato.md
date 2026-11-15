---
status: accepted
---

# L'accesso con un JWT firmato, riletto ogni ora

Con #72 l'accesso è nato con la sessione in D1: un token casuale nel cookie,
una riga `Sessione` con la scadenza, e `accesso.GetSessione` che a ogni
richiesta la legge e ne sposta la scadenza, cioè una scrittura per richiesta,
con i conflitti che due richieste insieme si portano dietro. Con i permessi
(#93) il core ha bisogno di sapere chi chiama, a ogni use case: è il momento di
decidere da dove arriva quell'informazione.

La decisione ha tre parti.

**Un JWT firmato al posto della sessione.** Al login la webapp firma un token
(HS256, segreto `JWT_SECRET` del Worker, uno per ambiente) con dentro
l'`IUtente`: id, username, Amministratore, ruoli, BU e il cambio password
obbligatorio. Sta in un cookie `HttpOnly`, `Secure`, `SameSite=Lax`, che dura
**30 giorni dall'ultimo uso**: finché si usa il CRM non si rientra. Il logout
cancella il cookie. La tabella `Sessione` se ne va; `TentativiAccesso` resta,
perché riguarda il login e non la sessione.

**Riletto ogni ora.** I claim valgono un'ora dalla firma (`iat`). Passata
l'ora, alla prima richiesta la webapp rilegge l'utente dal D1: se c'è ancora,
rifirma il token con i ruoli e i flag di adesso; se non c'è, lo butta e si
torna al login. Il D1 si legge al più una volta l'ora per utente, e non si
scrive mai per tenere viva una sessione.

**L'autenticazione al bordo, l'autorizzazione nel core.** Il token lo firma e
lo verifica la webapp (`app/autenticazione.server.ts`), che passa l'`IUtente`
nell'`ExecutionContext` (`{ utente?: IUtente }`, nel contract) di ogni use
case. Il core non conosce il token: decide cosa l'utente può fare, con le
policy di #94. Gli use case della sonda girano senza utente: la autentica la
firma HMAC sulle sue route (#50), e la loro policy è `Anyone`. Una route della
webapp che chiamasse uno use case della sonda senza utente passerebbe: è un
patto che la webapp rompe, non un buco che il core deve chiudere.

## Le alternative scartate

- **La sessione in D1, com'era.** Revoca immediata, ma una scrittura a ogni
  richiesta e lo stato da tenere sul server.
- **Il JWT puro, a scadenza lunga.** Niente database, ma un utente cancellato o
  un ruolo tolto varrebbero solo alla scadenza, dopo settimane.
- **Rileggere l'utente a ogni richiesta.** Revoca immediata, ma il token si
  riduce a un id firmato e il database si legge sempre.
- **Un'entità `Utente` nel contesto.** Le policy leggono soltanto, e un'entità
  caricata fuori dalla Unit of Work scriverebbe fuori dal patto del `save`
  (ADR 0011). Chi modifica sé stesso si rilegge dentro `work`.

## Le conseguenze che vale la pena conoscere

- **Revocare costa al più un'ora.** Un utente cancellato, un ruolo cambiato o
  una password azzerata dall'Amministratore valgono alla prossima rilettura.
  Se servisse una revoca immediata, si aggiunge una lista piccola di token
  revocati, non le sessioni.
- **Ruotare `JWT_SECRET` fa uscire tutti.** È anche il modo di farlo apposta.
- **Il proprio cambio password rifirma subito il token**, senza aspettare
  l'ora: è la stessa richiesta. Gli altri token dell'utente, firmati prima,
  alla rilettura non valgono più (#79): l'`Utente` porta
  `password_changed_at`, e `accesso.GetUtente` lo confronta con la firma.
- **Chi agisce viene dal contesto, non dall'input.** Gli use case che un
  utente fa su sé stesso (cambiare la propria password, passare una pratica)
  leggono `ctx.utente`; quelli che agiscono su un altro utente ne hanno l'id
  nell'input.

Contesto: la mappa #93; decisione del 12 novembre 2026, con Dario.
