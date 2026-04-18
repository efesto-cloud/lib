# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

`@efesto-cloud/lib` is a pnpm workspace monorepo publishing a set of `@efesto-cloud/*` packages used across projects in the efesto-cloud org. Node `>=24`, pnpm `>=9`, Changesets for versioning/release.

Workspaces: `packages/*` and `example` (see [pnpm-workspace.yaml](pnpm-workspace.yaml)).

## Common commands

Run from the repo root:

- `pnpm build` — build all packages (`tsc` per package)
- `pnpm typecheck` — `tsc --noEmit` across all packages
- `pnpm test` — run tests across all packages
- `pnpm biome` — Biome check (lint + format). Use `pnpm exec biome check --write .` to auto-fix and format
- `pnpm knip` — detect unused files/exports/deps
- `pnpm check-packages` — validates package manifests via [scripts/check-packages.mjs](scripts/check-packages.mjs) (naming, exports, etc.)
- `pnpm changeset` — add a changeset; `pnpm release` builds and publishes

Per-package: `pnpm --filter @efesto-cloud/<name> <script>` (e.g. `build`, `typecheck`, `clean`). Tests are per-package — check that package's `package.json` for the runner (not all packages have tests).

## After editing

Always run, in order, and resolve errors before finishing:

1. `pnpm typecheck`
2. `pnpm exec biome check --write .`
3. `pnpm knip`

When a package under `packages/` is added or modified, ask the user whether to generate a changeset (`pnpm changeset`) before finishing.

## Architecture

Each package under [packages/](packages/) is an independently published ESM-only TypeScript library following an identical shape:

- `type: "module"`, entry `dist/index.js`, types `dist/index.d.ts`
- `exports` map exposes both `.` and `./*` subpath exports pointing into `dist/`
- Sources in `src/`, built with a local `tsconfig.json` extending the root [tsconfig.json](tsconfig.json) (strict, NodeNext, `verbatimModuleSyntax`, declaration+sourcemap, `rootDir: src`, `outDir: dist`)
- `files: ["dist"]`, `publishConfig.access: public`

When adding a new package, mirror this layout; `scripts/check-packages.mjs` enforces the conventions (package name prefix `@efesto-cloud/`, exports shape, etc.).

Knip config in [knip.json](knip.json) declares workspace-specific entrypoints; add an entry there for any package that exposes non-standard entrypoints (e.g. `examples/*.ts`).

Biome config in [biome.json](biome.json): 4-space indent, LF, double quotes, organizeImports on, uses `.gitignore`.
