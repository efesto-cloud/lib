# Example: one domain, five rungs

The same small application built at every rung of the blueprint. Two
neighbouring folders differ by exactly one move, so `diff` shows what climbing
a rung costs:

```bash
diff -r -x node_modules -x pnpm-lock.yaml example/2b-bootstrap example/2c-bus
```

| Folder | Rung | What it adds |
|---|---|---|
| `0-single` | 0 | One package: routes, rules and queries in the same place |
| `1-core` | 1 | `packages/core`: entities, value objects, errors, ports, use cases, policies. The SQLite implementations still live in the core |
| `2a-adapters` | 2·A | The implementations move to `adapters/` (db, mail, file), plus `stub-adapter`. Use cases are tested against the stub |
| `2b-bootstrap` | 2·B | `packages/bootstrap` with one profile per process, `webapp-staff` and `webapp-admin`, a job queue and its `consumer` |
| `2c-bus` | 2·C | `commands` (the contract), `bus` (dispatcher, handlers, middleware, channels), `bus-server`. The webapps stop booting the core and call `bus.dispatch` |

Run every rung's typecheck and tests:

```bash
pnpm example        # from the repository root: bash example/check.sh
```

## The domain

Expense reports. An expense moves `draft → submitted → approved | rejected → reimbursed`;
the entity refuses any other transition. Every transition writes an
`ExpenseStatusChange` in the same transaction. Approving notifies the author by
mail: directly up to 2·A, through a queued `NotifyAuthor` job from 2·B.
`ImportExpenses` reads a file and calls `CreateExpense` for each row inside one
transaction, so a bad row undoes the others.

Three members are seeded: Anna and Bruno (staff), Carla (admin). Staff create
and submit their own expenses; admins review, reimburse and import.

## How to read it

- **One scenario, every rung.** `expenses.test.ts` is the same file in all five
  folders. Only `harness.ts` changes: it wires whatever the rung has. From 2·A
  it runs on the stub and on SQLite; at 2·C also over both channels.
- **Errors are values.** Use cases return Effect's `Result`; domain errors are
  `Schema.TaggedError` classes in the core. At 2·C a command declares which of
  them it can answer with, and they cross HTTP as instances of their class.
  Anything undeclared arrives as a bare `InternalError`.
- **Policies.** Every use case has a policy in `core/src/auth/policies.ts`. The
  map's type requires every key of the registry, so a use case without a policy
  does not compile. Up to 2·B each webapp applies them on every route; at 2·C
  the bus middleware applies them once. `packages/bus/test/policies.test.ts.snapshot`
  lists command → use case → policy, so a permission change shows up in the diff.
- **A wrong handler does not compile.** At 2·C `handler()` checks that the use
  case's input and `Result` match the command's schemas.

## Choices made for the example, not rules

- The webapps are plain `Request → Response` functions, not React Router apps,
  so every rung runs under `node --test` with no build.
- Packages export their TypeScript sources and are run with `tsx`; there is no
  build step. `tsx` gets `--tsconfig` pointing at the workspace base config,
  otherwise it compiles other packages' files without legacy decorators.
- `node:sqlite` is the real database, a second SQLite file the real queue, an
  HTTP endpoint the real mailer. They stand in for whatever a project uses.
- Each rung is its own pnpm workspace, outside the repository's, so package
  names stay the same across rungs and diffs stay readable. The `@efesto-cloud/*`
  packages are linked with `file:`, which copies `dist` at install time:
  `check.sh` builds them first.
- At 2·A and later `core` lists `stub-adapter` as a dev dependency for its
  tests, and `stub-adapter` depends on `core`. pnpm warns about the cycle; it
  is harmless for typecheck and tests.
