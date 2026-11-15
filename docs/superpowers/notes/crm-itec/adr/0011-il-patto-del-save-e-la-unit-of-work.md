---
status: accepted
---

# Il patto del `save` e la Unit of Work

Il core aveva una sola entity, `Utente`, scritta a mano e senza versione; la
sessione e i tentativi di accesso erano valori passati alle repository, e ogni
repository scriveva a modo suo (`create` e `save`, `save` e `delete`, upsert).
Con le pratiche più persone toccheranno lo stesso dato: il patto fra entity,
repository e use case si fissa prima, quando costa poco.

La decisione ha quattro parti.

**L'entity porta la sua versione.** La base `Entity` del core (non
`@efesto-cloud/entity`, che vuole luxon e mette `deleted_at` a tutte) ha
`id`, `v` e `isNew()`: `v` è 0 per un'entity nuova, e cresce di uno a ogni
salvataggio. La carica il mapper della repository, e lo use case non la tocca:
fra persone vince l'ultima scrittura, come nei gestionali, e nessuna `v`
viaggia nei form. `deleted_at`, `created_at` e `updated_at` non sono della
base: si mettono dove il dominio li vuole (`Utente` ha `deleted_at`). Chi si
cancella davvero (`Sessione`, `TentativiAccesso`) espone un metodo di dominio
(`close()`, `reset()`) che chiama il `remove()` protetto della base.

**Un solo `save(entity)`, che accoda.** Ogni repository di entity ha le letture
che servono e un `save` che non scrive: accoda nella Unit of Work dello use
case.
Dentro sceglie con lo stato dell'entity: nuova → `INSERT` (con `v = 1`),
cancellata → controllo della versione e `DELETE`, altrimenti

```sql
UPDATE "Utente" SET …, v = CASE WHEN v = ?letta THEN v + 1 END WHERE id = ?
```

con `v INTEGER NOT NULL`. Niente upsert: un `INSERT` su un `id` che c'è già è
un conflitto, non una sovrascrittura. Un'entity salvata due volte nella stessa
esecuzione si scrive una volta, con l'ultimo stato. I registri append-only
(i cambi di stato della sonda) non sono entity, ma la loro riga si accoda
nella stessa Unit of Work (`D1UnitOfWork.append`), e si scrive con le entity.

**La Unit of Work.** `IUnitOfWork.runWithTransaction(work)` esegue `work`,
poi scrive la coda in una transazione breve, tutto o niente: su D1 un
`db.batch()`, l'unica transazione che D1 ha. Nessuna riga resta bloccata
mentre lo use case ragiona, e le letture dentro `work` non vedono la coda: si
legge, si decide, poi si scrive. Un `save` è la decisione di scrivere: se
`work` poi restituisce un errore la coda si scrive lo stesso (il login fallito
conta il tentativo e risponde con l'errore); si butta solo se `work` lancia.

**Il conflitto fa fallire il batch intero, e si ripete.** Contare le righe
toccate basta dove la transazione è interattiva (Postgres, SQLite), non su D1,
che dà i conteggi a batch già confermato. Con una versione vecchia il `CASE`
dà `NULL`, il vincolo `NOT NULL` fa fallire l'`UPDATE` e D1 annulla tutto il
batch; un vincolo di unicità violato (la riga nuova c'è già, lo username preso
nel frattempo) è un conflitto allo stesso modo. Sul conflitto `work` si ripete
da capo, tre volte in tutto: rilegge, gli `if` dello use case ricontrollano,
riaccoda. Poi resta `ConflictError`, nel contract. Una riga che intanto è
stata cancellata davvero (l'`UPDATE` non tocca niente) si vede solo dai
conteggi, a batch confermato: il resto della coda è scritto, e
`runWithTransaction` restituisce `ConflictError` senza ripetere.

## Una Unit of Work per esecuzione di use case

`inRequestScope` di Inversify non è la richiesta HTTP: è una risoluzione
(`container.get`). Ogni `resolveUseCase(key)` è una risoluzione, quindi una
Unit of Work e le sue repository per ogni esecuzione di use case, anche col
container tenuto per tutto il Worker (`workers/bootstrap.ts`). Per questo
`installD1` lega la Unit of Work e le repository che la ricevono
`inRequestScope`: una repository singleton terrebbe per sempre la `uow` della
prima richiesta. Un use case risolto una volta ed eseguito due volte in
sequenza usa la stessa `uow`, che si svuota a ogni giro; due esecuzioni
sovrapposte sulla stessa `uow` lanciano. Nel codice la porta è `IUnitOfWork`,
il simbolo `UnitOfWork`, e chi la riceve la chiama sempre `uow`.

**Ogni adapter esporta il suo install**, `install<Tecnologia>(opts):
ContainerModule` (`installD1({ DB })`, `installSqlServer`, `installHttp`,
`installStub`), e le composition root caricano il core e i moduli. La Unit of
Work D1 è per risoluzione, quindi le repository le costruisce Inversify
(`@injectable()`, `.to(…).inRequestScope()`), non più `toConstantValue(new …)`.

## Cosa si è scartato

- **Un trigger** `BEFORE UPDATE … RAISE(ABORT)`: funziona, ma è codice nel
  database da tenere allineato a mano. Il `CASE` su `NOT NULL` fa lo stesso,
  e vale uguale su Postgres.
- **`UPDATE … WHERE v = ?` e il conteggio**: su D1 non annulla le altre
  scritture del batch.
- **Una tabella di guardia** per far fallire anche la riga sparita dentro il
  batch: un pezzo in più per un caso che oggi tocca solo sessioni e tentativi,
  le sole entity che si cancellano davvero.

## Le conseguenze che vale la pena conoscere

- **La versione protegge una riga, non una regola fra righe.** Due
  Amministratori che si tolgono il flag a vicenda scrivono righe diverse, e
  tutti e due passano il controllo dell'ultimo Amministratore: un invariante
  su più righe va controllato dentro il batch, o con un'entity che lo tenga.
  Per l'ultimo Amministratore (#92) si controlla dentro il batch, nello stesso
  `CASE` su `v`: l'`UPDATE` di `Utente` che toglie il flag o elimina un
  Amministratore vivo dà `NULL` se nel database confermato non ne resta un
  altro. Il batch fallisce come per una versione vecchia, lo use case si
  ripete, rilegge un solo Amministratore e risponde `LastAmministratoreError`.
  Niente schema nuovo; una riga che porti la regola (un contatore con la sua
  `v`, salvato a ogni cambio del flag) sarebbe servita solo se D1 non sapesse
  valutare la sottoquery dentro l'`UPDATE`.
- **Una sessione chiusa mentre un'altra richiesta la prolunga** dà a quella
  richiesta `ConflictError`, e il guscio la tratta come una richiesta senza
  sessione.
- **Un use case che vuole «o va o errore»** (un'approvazione decisa su ciò che
  una persona ha visto) prenderà la `v` dall'input e spegnerà la ripetizione:
  il patto lo permette senza cambiare.
- **Le repository D1 si provano dalla webapp**, nel runtime dei Worker
  (`apps/webapp/test/salvataggio.test.ts`), come dice
  [0010](0010-apps-packages-adapters.md): un vitest dei Worker anche in
  `d1-adapter` sarebbe una seconda configurazione per gli stessi test.

## Come si aggiunge

- **Un'entity**: `core/src/entity/<Entità>.ts`, `extends Entity<Props>` (con
  `Entity<Props, number>` se l'id è un numero), costruttore `(id, props, v)`
  usato dal mapper, e una `static create(…)` che passa `v = 0`. I metodi
  cambiano `props`; chi si cancella davvero espone un metodo che chiama
  `remove()`.
- **La sua porta**: `core/src/repo/I<Entità>Repository.ts`, con le letture e
  `save(entity): void`. Lo use case che scrive riceve
  `InternalSymbols.UnitOfWork` e lavora dentro `runWithTransaction`; la
  sua `Error` comprende `ConflictError`.
- **La repository D1**: `@injectable()`, riceve la `D1UnitOfWork` con
  `@inject(InternalSymbols.UnitOfWork)`, il mapper passa `row.v`, e `save`
  chiama `uow.save(entity, () => [istruzioni])`: per un'entity che non è
  nuova né cancellata la prima istruzione è l'`UPDATE` col `CASE` su `v`; per
  una cancellata `uow.checkVersion(…)` e poi il `DELETE` (una riga già
  cancellata non è un conflitto).
- **Il suo install**: una riga in `installD1`, `.to(<Entità>RepoImpl)
  .inRequestScope()`.
- **La colonna**: `v INTEGER NOT NULL DEFAULT 1` nella tabella; in una
  migrazione su una tabella che esiste, con `ALTER TABLE … ADD COLUMN`.
- **Il suo test del patto**: una chiamata a `pattoDelSave` in
  `apps/webapp/test/salvataggio.test.ts`, con un'entity nuova, la lettura, il
  `save` e un cambiamento: nuova → insert, `id` che c'è già → conflitto,
  versione vecchia → conflitto.

Decisione dell'11 novembre 2026, con #89.
