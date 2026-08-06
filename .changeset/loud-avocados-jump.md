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

Packaging: `zod` passa da devDependency a peerDependency opzionale di
result, cosi' da comparire nel manifest come gia' compariva nei tipi
pubblici. Attenzione: da solo questo non rende risolvibile il `.d.ts` per
chi installa result senza zod, perche' `dist/index.d.ts` importa ancora i
tipi di zod in modo incondizionato — serve comunque `skipLibCheck: true`
oppure zod installata. La correzione completa richiede spostare `fromZod`
su un export dedicato, ed e' rimandata.

`@efesto-cloud/toast` dichiara ora `dependencies` su maybe e result invece
di `peerDependencies`, allineandosi alla convenzione degli altri package del
monorepo: non e' piu' il consumatore a doverle installare.
