# Conventions — Oasis invariants

These are the rules every Oasis-style project follows. The scaffold respects them. Don't deviate without user confirmation.

## Package manager

- **pnpm** (not npm, not yarn). Uses the workspace protocol (`"{{ns}}/core": "workspace:*"`).
- Root has a `pnpm-workspace.yaml` listing `packages: - packages/*`.
- `onlyBuiltDependencies` whitelist includes `@parcel/watcher` and `esbuild`.

## TypeScript

- **TypeScript 6** in core and mongodb. `@types/node: ^24`.
- **TypeScript 5.9** in webapp (dictated by React Router 7 compatibility). `@types/node: ^22`.
- Target: `ES2023` (core/mongodb) or React-Router default (webapp).
- Module: `nodenext`.
- Strict mode: **on**.
- `experimentalDecorators` + `emitDecoratorMetadata` ON for core (Inversify).
- Path alias: `"~/*": ["./src/*"]` — used across all packages.
- Build tool: `tsc --build` + `tsc-alias` (postbuild) for core and mongodb.
- Webapp builds via `react-router build` (Vite under the hood).

## Imports

- **ESM only** (`"type": "module"` in every package.json).
- **Always use `.js` extension in imports** — even when importing a `.ts` file. `tsc-alias` preserves them; nodenext requires them.
  ```ts
  import Foo from "~/entity/Foo.js";  // ✓
  import Foo from "~/entity/Foo";     // ✗ fails at runtime
  ```
- Path alias first (`~/entity/Foo.js`), then package imports (`@efesto-cloud/maybe`), then node builtins.

## Linting / formatting

- **Biome** (not ESLint, not Prettier). Config at repo root `biome.json`.
- Indent: 4 spaces.
- Quote style: double.
- `unsafeParameterDecoratorsEnabled: true` (required for Inversify `@inject`).
- Run with `pnpm biome`.

## Dependency injection

- **Inversify** container with hierarchical `Symbols` registry.
- Core owns `di/container.ts` and `di/Symbols.ts`; MongoDB contributes bindings via a `ContainerModule` exported from `install.ts`.
- Use `@inject(Symbols.Repo.XyzRepo)` in constructors.
- Call `await initContainer()` once at boot. Webapp's `server.mjs` does:
  ```js
  await initContainer();
  container.load(install());  // MongoDB module, if has_mongodb
  ```

## Domain invariants (scaffolded directories only — no content generated)

These dirs exist with `.gitkeep` so the skill's output matches Oasis layout. The specialized skills (`entity`, `value-object`, etc.) fill them in.

**Core** (`packages/core/src/`):
- `entity/` — PascalCase files; class extends `Entity<Props, Id>` from `@efesto-cloud/entity`.
- `dto/` — `I<EntityName>` interfaces; primitives only.
- `value_object/` — `I<Name>` interface, `impl/<Name>.ts` implementation.
- `enum/` — `<PascalCase>` enums.
- `type/` — `T<PascalCase>` unions.
- `errors/` — `<EntityName>Error` classes.
- `dict/` — `Desc<Name>` static lookup tables.
- `repo/` — `I<Name>Repo` interfaces (ports); methods `get()`, `search()`, `save()` — never `delete()` (soft-delete via `entity.delete()` then `repo.save()`).
- `service/` — `I<Name>Service` port interfaces.
- `useCase/<domain>/` — use cases grouped by business domain; extend `IUseCase<Input, Output>`; return `Result<T, E>` or `Maybe<T>`; `@audit` decorator for mutations.
- `decorator/` — `audit.ts` + any custom decorators.
- `shape/` — Zod schemas for validation.

**MongoDB** (`packages/mongodb/src/`):
- `Collections/` — typed collection wrappers.
- `Documents/` — `<Entity>Doc` shapes for BSON.
- `Repo/` — `<Entity>Repo implements I<Entity>Repo`.
- `mapper/` — `<Entity>Mapper` converts entity ↔ document.
- `query/` — reusable query builders.
- `populate/` — aggregation pipelines for cross-collection population.

**Webapp** (`packages/webapp/app/`):
- `routes/` — React Router file-based routes.
- `components/` — UI components.
- `shared/` — utilities, validators, shared logic.
- `i18n/` — locale dictionaries.
- `@types/` — global type augmentations.

## Output code style

Generated files must match Oasis style out of the box:
- 4-space indent, no tabs.
- Double quotes.
- Trailing newline at EOF.
- No trailing whitespace.
- Group imports: `reflect-metadata` first (servers), then node builtins, then `@efesto-cloud/*` / external packages, then `~/*` aliases.
- TypeScript: explicit return types on exported functions; `async` signatures match.

## Error handling

- Use `Result<T, E>` from `@efesto-cloud/result` for operations that can fail.
- Use `Maybe<T>` from `@efesto-cloud/maybe` for optional queries.
- Domain errors live in `/src/errors/`.
- Return `Result.err(error)` — don't throw. The skeleton does not generate any `throw` sites.

## Locale & timezone

- Core's `server.ts` initializes Luxon at import time:
  ```ts
  import { Settings } from "luxon";
  Settings.defaultLocale = "{{locale}}";
  Settings.defaultZone = "{{timezone}}";
  Settings.defaultWeekSettings = { firstDay: 1, minimalDays: 4, weekend: [6, 7] };
  ```
- Webapp `root.tsx` sets `<html lang="{{locale | language-only}}">` (e.g. `it` for `it-IT`).

## Things the scaffold does NOT do

- No Prisma adapter (MongoDB only in v1).
- No GitHub Actions (GitLab CI only in v1).
- No admin + client split (single webapp in v1).
- No sample entity / use case / repo — those belong to the specialized skills.
- No `pnpm install` — user runs it.
- No commits — user inspects then commits.
