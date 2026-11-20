# Tests

| What | How | How many |
|---|---|---|
| Domain | entities and `core/rule/` functions, pure, in `core/src/**/test/` | every invariant and every transition, preferably as a table (`it.each`) |
| Use cases | through the real composition root, on the real database run locally (for D1: the Workers runtime with the real migrations, `@cloudflare/vitest-plugin` with `cloudflareTest` and `readD1Migrations`). The core's fakes (`core/src/_testing`) are for ports that talk to an external system | the happy path and the errors of its `Error` union |
| Save contract | one shared function called for each entity repository, where the use case tests run | per entity: new → insert; existing id → conflict; stale version → conflict |
| Adapter alone | in its own package | what the composition root does not cover |
| Types | `@ts-expect-error` inside `.test.ts` files, enforced by `tsc` | every "does not compile" promise: wrong key, missing implementation, missing error message |
| End-to-end | Playwright in `apps/e2e`, outside the unit test run | one per user flow, not per error |

## The save contract test

```ts
// apps/webapp/test/save.test.ts
function saveContract<E extends Entity<unknown, unknown>>(name: string, c: {
    repo: (uow: D1UnitOfWork) => { save(e: E): void; find(id: unknown): Promise<E | null> };
    create: () => E;
    change: (e: E) => void;
}) {
    describe(name, () => {
        it("inserts a new entity with v = 1", async () => { /* … */ });
        it("an existing id is a conflict, not an overwrite", async () => { /* … */ });
        it("a stale version is a conflict and rolls back the whole batch", async () => { /* … */ });
    });
}

saveContract("Expense", { repo: (uow) => new ExpenseRepoImpl(uow), create: …, change: … });
```

Adding an entity adds one call.

## Fakes

- The core's fakes live in `core/src/_testing/` (`InMemory*`, `Fixed*`,
  `Failing*`, `Throwing*`) and are used only by the core's tests, which build a
  container with just the module under test and bind the fakes with
  `toConstantValue`. A fake Unit of Work is `runWithTransaction: (work) => work()`.
- The `stub-adapter` is not a test fake: it serves local development and the
  seed.

## Gate

CI runs Biome, knip, typecheck and tests. After `biome --write`, run the tests
again, not only the typecheck: some "safe" fixes change behaviour. Packages
build to `dist`, so build before testing.
