# Packages, imports and build

## Folders

```
apps/
  webapp/            composition root on Cloudflare Workers (React Router)
  <process>/         a Node process with its own composition root
  e2e/               Playwright
packages/
  contract/          @<scope>/contract
  core/              @<scope>/core
  db/                @<scope>/db: Prisma schema and migrations
adapters/
  d1-adapter/        @<scope>/d1-adapter
  stub-adapter/      @<scope>/stub-adapter
```

- **apps** are composition roots: they choose the adapters, bind them to the
  core's ports, and know where configuration and secrets come from. The seed
  script and every test that builds a container are composition roots too.
- **packages** hold the contract, the core, and shared non-adapter code such as
  the database schema.
- **adapters** are one package per technology, `@<scope>/<technology>-adapter`.
  The `stub-adapter` has its own implementations and the fake data for local
  development (the seed); it does not bind the core's test fakes.

## Dependency rule

app → adapter → core and contract; core → contract. Nobody imports an app; an
adapter never imports another adapter. Tests follow the same rule: core tests
use the core's fakes, an adapter's own tests live in its package.

## What a client may import

- Client code (components, pages) imports the **contract** and the pure rules
  in **`core/rule/*`**.
- The rest of the core (use cases, container, DI) is imported only by the
  composition root and by server-side modules, recognisable by the `.server.ts`
  suffix.
- Use cases, the container and adapters never end up in a client bundle.

## Exports and build

```jsonc
// packages/core/package.json
{
  "name": "@acme/core",
  "type": "module",
  "sideEffects": false,
  "exports": { "./*": "./dist/*.js" },
  "scripts": { "build": "tsc --build && tsc-alias" }
}
```

- **No barrels.** No `index.ts` re-exporting a package; every module is
  imported by path: `@acme/core/di/install`.
- Contract, core and adapters compile to `dist/`, all with
  `"sideEffects": false`. Node does not strip types inside `node_modules`, and a
  Node process depends on these packages, so they ship JavaScript.
- Inside a package, import with the `~/` alias and the `.js` extension
  (`import Expense from "~/entity/Expense.js"`); across packages, by path
  without extension (`import type IExpense from "@acme/contract/interface/IExpense"`).
- Build before testing: the packages are consumed from `dist`.

## One symbol per file

Every file has one symbol and `export default` (`type X = …; export default X`,
`export default interface IExpense`, `export default class ExpenseNotFoundError`).
The exception is an input: its schema and its type share a name and are named
exports, next to the interface's default export.
