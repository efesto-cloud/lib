---
"@efesto-cloud/result": major
"@efesto-cloud/result-async": major
"@efesto-cloud/maybe": major
"@efesto-cloud/maybe-async": major
"@efesto-cloud/toast": major
---

BREAKING: `match` passa dalla forma posizionale a quella a oggetto —
`match({ ok, err })` per Result/ResultAsync/Toast, `match({ some, none })`
per Maybe/MaybeAsync. `Maybe.combine(m1, m2)` e' rimosso, sostituito da
`Maybe.all([...])` variadico e tuple-typed. `fold` resta ma e' deprecato:
aveva gli argomenti in ordine inverso rispetto al vecchio `match`, ed e' il
footgun che questo cambio elimina.

Aggiunti: `all`, `partition`, `flatten`, `tapBoth`, `isOk`/`isErr` e
`fromSchema` (Standard Schema, indipendente da zod) su Result; `tapBoth`,
`fromResult`, `allAsync` e `partitionAsync` su ResultAsync; `flatten`, `or`,
`fromResult` e `toResult(errorFactory)` su Maybe. Result esporta inoltre i
due tipi `OkOf<R>` ed `ErrOf<R>`, che estraggono i parametri di un Result.

BREAKING: `Result.fromZod` e' rimosso. Usa `Result.fromSchema(schema,
input)`, che accetta qualunque validatore Standard Schema — zod 4 incluso —
e restituisce `Result<Output, readonly Issue[]>`. La migrazione e' diretta:
`Result.fromZod(S.safeParse(x))` diventa `Result.fromSchema(S, x)`. Cambia il
tipo del canale errori, da `ZodError<Output>` a `readonly
StandardSchemaV1.Issue[]`.

Con `fromZod` sparisce l'unico import dei tipi di zod dal `.d.ts` pubblico,
e con esso il problema di packaging che affliggeva questo package: `result`
non dichiara piu' zod ne' fra le dependencies ne' fra le peerDependencies, e
il suo `dist/index.d.ts` e' risolvibile senza `skipLibCheck` e senza avere
zod installata. `@standard-schema/spec` resta l'unica dipendenza, ed e' di
soli tipi.

`@efesto-cloud/toast` dichiara ora `dependencies` su maybe e result invece
di `peerDependencies`, allineandosi alla convenzione degli altri package del
monorepo: non e' piu' il consumatore a doverle installare.

Fix: `fromSchema` ora rileva un `validate()` asincrono in modo strutturale
(callable `then`) invece di `instanceof Promise`, cosi' da lanciare anche su
thenable non nativi o Promise cross-realm (node:vm, worker, iframe) invece
di restituire in silenzio `ok(undefined)`.

Fix (cambio di comportamento osservabile): uno schema che lancia in modo
sincrono durante la validazione ora produce un `Failure` con degli issues,
invece di lasciar propagare l'eccezione grezza — `fromSchema` resta totale
sui dati, come ogni altra funzione del package. Zod converte pero'
QUALSIASI throw interno (anche uno sincrono, come un `transform`/`refine`
non difensivo) in una Promise gia' rifiutata: prima di questa fix quella
Promise veniva scartata senza handler dopo aver lanciato il `TypeError`
del ramo thenable, causando una unhandled rejection; ora viene neutralizzata
con un `.catch()` prima del throw. Il messaggio del `TypeError` e' stato
riformulato di conseguenza: «asincrono» e «lo schema ha lanciato» sono
indistinguibili a valle con zod, e il messaggio ora lo dice.
