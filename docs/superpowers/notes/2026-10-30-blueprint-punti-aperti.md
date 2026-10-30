# Blueprint: punti aperti al 30 ottobre 2026

Stato del branch `docs/32-skill-blueprint` a fine sessione. Il documento di
riferimento resta `blueprint/index.html` (registro fino al giro 14); il deck è
in `blueprint/deck/`. Qui stanno solo le cose **non decise o non fatte**, da
riprendere prima di riscrivere la skill.

## Fatto

- `example/` completo, dal gradino 0 al 2·C: `pnpm example` fa girare
  typecheck e test di tutti i gradini, e sono verdi. README in `example/README.md`.
- `@efesto-cloud/usecase`: `IUseCase<I, R extends Result>` (Result di Effect),
  tolto il campo `name`.
- `@efesto-cloud/unit-of-work`: `runWithTransaction` riceve e ritorna un
  `Result` e fa rollback anche quando lo use case fallisce.
- `audit` rimosso dal repo.
- Documento: sezione «Il quadro completo», §10 con quello che l'esempio ha fissato.
- Deck di 22 slide, con le slide dei gradini animate (Auto-Animate).

## Da decidere

1. **Q11, dove si dichiara la policy.** L'esempio propone una mappa nel core
   (`core/src/auth/policies.ts`), una policy per use case. Il tipo richiede ogni
   chiave del registro, quindi uno use case senza policy non compila. Gli use
   case interni hanno la policy `internal`. Il comando non porta la policy:
   chi la cerca la trova nello snapshot comando → use case → policy. Il
   documento nei §5–6 mostra ancora `policy: can(...)` dentro il comando:
   allinearlo quando si decide.
2. **Changeset** per `usecase` e `unit-of-work`, cambi incompatibili con le
   versioni pubblicate. Non generati.
3. **Ciclo `core` ↔ `stub-adapter`** dal 2·A: il core usa lo stub nei test
   (devDependency), lo stub dipende dal core. pnpm lo segnala con un warning,
   ma typecheck e test funzionano. L'alternativa è un pacchetto di test separato.
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
