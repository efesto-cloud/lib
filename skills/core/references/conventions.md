# Conventions

The rules of this codebase, each with the why behind it. None of them
are absolute, but every deviation should be a deliberate choice.

## `Result<T, E>` everywhere — never throw in the domain

Domain factories (`Foo.create(...)`), entity mutator methods
(`foo.update(...)`), and use cases all return
`Result<T, DomainError>`. Throwing escapes the type system: the caller
has no idea which exceptions can happen, so they default to either
catching `Error` (and losing the discriminated union) or letting the
process crash.

```ts
// Yes.
static create(props: {...}): Result<Foo, DomainError> {
    if (props.name.length === 0) return Result.err(new EmptyFooNameError());
    return Result.ok(new Foo({...}));
}

// No.
static create(props: {...}): Foo {
    if (props.name.length === 0) throw new Error("empty name");
    return new Foo({...});
}
```

The exceptions are:

- **Mapper `from` on corrupted DB rows.** If a row violates an
  invariant the DB should have enforced (e.g. `EmailAddress.create`
  fails on a stored email), it's a programming/operations bug — throw
  so the load-time stack trace points at the bad row. See
  `prisma-persistence.md`.
- **`result.unwrapOrThrow()` at the HTTP boundary.** The route
  loader/action runs in `react-router`'s error envelope and turns the
  thrown error into a 500 — appropriate only when the failure means
  "server bug" rather than "user input was wrong".

## `Maybe<T>` for service-port nullables; `null` is fine for repo lookups

- A repo `findById(id)` returning `Foo | null` is a recognised idiom.
  Adding `Maybe<Foo>` here is more ceremony than payoff.
- A service-port method whose absence value carries meaning (e.g.
  "this member has no active session") returns `Maybe<T>` so the call
  site is forced to handle both cases via `isSome()`/`isNone()` or
  `fold(...)`.
- Anything inside the domain that's optional **and** has invariants
  attached uses `Maybe<T>`.

See `monad-maybe.md`.

## `.js` extensions on every local import

```ts
import Foo from "~/entity/Foo.js";          // even though the file is Foo.ts
import type IFooRepository from "~/repo/IFooRepository.js";
```

Why: `tsconfig.json` uses `"module": "nodenext"`, which mandates
explicit extensions, and the build pipeline (`tsc-alias`) rewrites
`~/...` to relative `./` paths during compile. Without the `.js`
suffix the post-build code wouldn't resolve.

External packages do not take the suffix:
`import { ContainerModule } from "inversify"`, not
`from "inversify.js"`.

## Path alias `~/*` → `src/*`

Use `~/entity/Foo.js`, never `../../../entity/Foo.js`. Deep relative
imports are brittle and noisy. The alias is defined in each package's
`tsconfig.json` and resolved at build time by `tsc-alias`.

## Soft-delete via `entity.delete()` + `repo.save()`

`@efesto-cloud/entity` ships `delete()`, `restore()`, `isDeleted()` on
the `Entity` base class. `delete()` sets `deleted_at = DateTime.now()`,
`restore()` sets it back to `null`. Persisting is the repo's job:
`repo.save(entity)` reads `entity.deleted_at` and writes the row.

Repo `findById` filters `deleted_at = null` by default; pass
`{ includeDeleted: true }` only when you genuinely want to see
soft-deleted records (used by restore use cases). `list` follows the
same rule with an explicit boolean flag in the filter object.

There is **no `repo.delete(id)` method**. Deletion is a domain event,
not a DB operation — the entity must be loaded first so audit fields
and last-mutated-by can be recorded.

The single exception is permanently-deleted resources (e.g. expired
sessions garbage-collected on a schedule). Those use case-specific
repo methods named after the operation (e.g.
`memberSessionRepo.purgeExpired()`), not `delete`.

## Use cases never call other use cases

Sharing behaviour across use cases goes through one of three channels:

1. **Entity methods** for invariant-protected mutations.
2. **Domain services** for cross-entity computation (e.g. tax
   calculation, code-generation policy).
3. **`util/`** helpers for pure functions (string normalisation,
   formatters).

Calling a peer use case smuggles one transaction into another, hides
dependencies behind an opaque resolver call, and tangles the
audit/decorator stack. If you find yourself wanting to do it, look
for a missing entity method or a domain service.

## Mappers live in the adapter package, not in core

Core defines the entity (`Member`) and the repo port
(`IMemberRepository`). The Prisma model type
(`Prisma.MemberGetPayload<{}>`) is a Prisma concept that doesn't
belong in core; therefore the mapper that bridges entity ↔ Prisma row
also lives in the adapter. The stub adapter doesn't have mappers
because its in-memory shape is the entity itself.

## Constructor injection only

```ts
@injectable()
export default class CreateMemberUseCase implements ICreateMemberUseCase {
    constructor(
        @inject(InternalSymbols.Repo.Member)
        private readonly memberRepo: IMemberRepository,
        @inject(InternalSymbols.Service.Clock)
        private readonly clock: IClock,
    ) {}
    // ...
}
```

No property injection, no `container.get(...)` calls inside a use
case body (service-locator anti-pattern). Dependencies should be
visible in the constructor signature so the impl's contract is
inspection-only.

## Authentication is the adapter's job

The webapp loader/action translates its transport credential
(session cookie, JWT, API key) into a `MemberDto | null` via
`IMemberAuthenticator` **before** invoking a use case. It packs the
actor into the use case's input or context:

```ts
const useCase = context.resolveUseCase("members.UpdateMemberProfile");
const result = await useCase.execute({
    member_id,
    name,
    code,
    actor,  // resolved by the loader
});
```

Use cases that need an actor open with a null-guard and trust the
field thereafter. They never call back into `IMemberAuthenticator` —
that re-verifies a credential the adapter already proved valid.

## Domain time zone: `Europe/Rome`

Set globally in `core/src/server.ts`:

```ts
import { Settings } from "luxon";
Settings.defaultLocale = "it-IT";
Settings.defaultZone = "Europe/Rome";
Settings.defaultWeekSettings = { firstDay: 1, minimalDays: 4, weekend: [6, 7] };
```

This makes `DateTime.now()` produce `Europe/Rome`-zoned values
throughout the domain. Entities that hold dates store
`DateTime<true>` (with timezone) and serialise to ISO strings
including the offset (`"2026-05-20T14:30:00+02:00"`).

Mappers reconstructing from JS `Date` should call
`.setZone(DOMAIN_ZONE)` (or equivalently rely on the default zone) so
they don't accidentally fall back to UTC.

## Locale: `it-IT`

Number formatting (`new Intl.NumberFormat()`), date formatting
(`DateTime.toLocaleString()`), and week-start (Monday) all derive from
the locale. Hardcoded English month names or day names should be
replaced with locale-aware formatters.

## Tooling: Biome (not ESLint/Prettier), pnpm (not npm/yarn)

- **Biome** handles lint + format in one tool. `pnpm biome` runs both.
  Config is `biome.json` at the repo root.
- **pnpm** workspaces aggregate the packages. Use `pnpm install`,
  `pnpm -r build`, `pnpm -r typecheck`. `npm` / `yarn` are not
  supported; the lockfile is `pnpm-lock.yaml`.
- **TypeScript strict mode** with `nodenext` module resolution. Every
  package has its own `tsconfig.json` extending the repo root one and
  declaring its `~/*` alias.

## `server.ts` vs `client.ts` split in core

Core exports two surfaces:

- `src/server.ts` — for Node / Cloudflare Workers consumers. Includes
  use case modules, the container, anything that uses
  `node:crypto`, etc.
- `src/client.ts` — for browser consumers (the webapp's client bundle).
  Pure data types only — DTOs, types, enums, dicts, value objects'
  type-only re-exports. Never imports anything that touches `process`,
  Node built-ins, or DB drivers.

Why: the webapp imports DTO types in its `loader` (server) **and** in
its React components (client). If both reach for `server.ts`, the
client bundle accidentally pulls in `process.env` references and
crashes at runtime. The split keeps the import graph clean.

The webapp's `loader.server.ts` files import from
`@task-management/core` (the default = server surface); React
components import from `@task-management/core/client`.
