# File Manifest — Ordered write list per layer

Write files in this exact order. `.tmpl` files live at `assets/<path>.tmpl` (strip the `.tmpl` suffix on output). Paths in "Output path" are relative to `{{target_dir}}`.

## Legend

- `[root]` always written
- `[core]` always written (core is mandatory)
- `[mongodb]` only if `has_mongodb`
- `[webapp]` only if `has_webapp`
- `[devcontainer]` only if `has_devcontainer`
- `[ci]` only if `has_gitlab_ci`
- `[docker]` only if `has_dockerfile`
- `[auth]` only if `auth_mode == "operator-session"` — overlay AFTER the base webapp templates
- `[keep]` write `.gitkeep` (no template needed; content is empty)

Order matters because some files reference siblings via imports; writing them top-down guarantees the skeleton is consistent at every intermediate step.

---

## Phase 1 — Root

| Layer | Template | Output path |
|---|---|---|
| `[root]` | `root/package.json.tmpl` | `package.json` |
| `[root]` | `root/pnpm-workspace.yaml.tmpl` | `pnpm-workspace.yaml` |
| `[root]` | `root/biome.json.tmpl` | `biome.json` |
| `[root]` | `root/.gitignore.tmpl` | `.gitignore` |
| `[root]` | `root/README.md.tmpl` | `README.md` |
| `[root]` | `root/CLAUDE.md.tmpl` | `CLAUDE.md` |

## Phase 2 — Core package (`packages/core/`)

| Layer | Template | Output path |
|---|---|---|
| `[core]` | `core/package.json.tmpl` | `packages/core/package.json` |
| `[core]` | `core/tsconfig.json.tmpl` | `packages/core/tsconfig.json` |
| `[core]` | `core/env.d.ts.tmpl` | `packages/core/env.d.ts` |
| `[core]` | `core/global.d.ts.tmpl` | `packages/core/global.d.ts` |
| `[core]` | `core/src/server.ts.tmpl` | `packages/core/src/server.ts` |
| `[core]` | `core/src/client.ts.tmpl` | `packages/core/src/client.ts` |
| `[core]` | `core/src/di/container.ts.tmpl` | `packages/core/src/di/container.ts` |
| `[core]` | `core/src/di/Symbols.ts.tmpl` | `packages/core/src/di/Symbols.ts` |
| `[core]` | `core/src/logger/logger.ts.tmpl` | `packages/core/src/logger/logger.ts` |
| `[keep]` | (write `.gitkeep`) | `packages/core/src/entity/.gitkeep` |
| `[keep]` | | `packages/core/src/dto/.gitkeep` |
| `[keep]` | | `packages/core/src/value_object/.gitkeep` |
| `[keep]` | | `packages/core/src/enum/.gitkeep` |
| `[keep]` | | `packages/core/src/type/.gitkeep` |
| `[keep]` | | `packages/core/src/errors/.gitkeep` |
| `[keep]` | | `packages/core/src/dict/.gitkeep` |
| `[keep]` | | `packages/core/src/repo/.gitkeep` |
| `[keep]` | | `packages/core/src/service/.gitkeep` |
| `[keep]` | | `packages/core/src/useCase/.gitkeep` |
| `[keep]` | | `packages/core/src/decorator/.gitkeep` |
| `[keep]` | | `packages/core/src/shape/.gitkeep` |

## Phase 3 — MongoDB package (`packages/mongodb/`) — conditional on `has_mongodb`

| Layer | Template | Output path |
|---|---|---|
| `[mongodb]` | `mongodb/package.json.tmpl` | `packages/mongodb/package.json` |
| `[mongodb]` | `mongodb/tsconfig.json.tmpl` | `packages/mongodb/tsconfig.json` |
| `[mongodb]` | `mongodb/src/index.ts.tmpl` | `packages/mongodb/src/index.ts` |
| `[mongodb]` | `mongodb/src/install.ts.tmpl` | `packages/mongodb/src/install.ts` |
| `[mongodb]` | `mongodb/src/init.ts.tmpl` | `packages/mongodb/src/init.ts` |
| `[mongodb]` | `mongodb/src/di/MongoSymbols.ts.tmpl` | `packages/mongodb/src/di/MongoSymbols.ts` |
| `[keep]` | | `packages/mongodb/src/Collections/.gitkeep` |
| `[keep]` | | `packages/mongodb/src/Documents/.gitkeep` |
| `[keep]` | | `packages/mongodb/src/Repo/.gitkeep` |
| `[keep]` | | `packages/mongodb/src/mapper/.gitkeep` |
| `[keep]` | | `packages/mongodb/src/query/.gitkeep` |
| `[keep]` | | `packages/mongodb/src/populate/.gitkeep` |

## Phase 4 — Webapp package (`packages/webapp/`) — conditional on `has_webapp`

| Layer | Template | Output path |
|---|---|---|
| `[webapp]` | `webapp/package.json.tmpl` | `packages/webapp/package.json` |
| `[webapp]` | `webapp/tsconfig.json.tmpl` | `packages/webapp/tsconfig.json` |
| `[webapp]` | `webapp/react-router.config.ts.tmpl` | `packages/webapp/react-router.config.ts` |
| `[webapp]` | `webapp/vite.config.mts.tmpl` | `packages/webapp/vite.config.mts` |
| `[webapp]` | `webapp/postcss.config.mjs.tmpl` | `packages/webapp/postcss.config.mjs` |
| `[webapp]` | `webapp/server.mjs.tmpl` | `packages/webapp/server.mjs` |
| `[webapp]` | `webapp/dev-server.mjs.tmpl` | `packages/webapp/dev-server.mjs` |
| `[webapp]` | `webapp/init.mjs.tmpl` | `packages/webapp/init.mjs` |
| `[webapp]` | `webapp/biome.json.tmpl` | `packages/webapp/biome.json` |
| `[webapp]` | `webapp/.gitignore.tmpl` | `packages/webapp/.gitignore` |
| `[webapp]` | `webapp/.env.tmpl` | `packages/webapp/.env` |
| `[webapp]` | `webapp/app/root.tsx.tmpl` | `packages/webapp/app/root.tsx` |
| `[webapp]` | `webapp/app/routes.ts.tmpl` | `packages/webapp/app/routes.ts` |
| `[webapp]` | `webapp/app/routes/_index.tsx.tmpl` | `packages/webapp/app/routes/_index.tsx` |
| `[webapp]` | `webapp/app/app.css.tmpl` | `packages/webapp/app/app.css` |
| `[webapp]` | `webapp/app/cookies.server.ts.tmpl` | `packages/webapp/app/cookies.server.ts` |
| `[keep]` | | `packages/webapp/app/components/.gitkeep` |
| `[keep]` | | `packages/webapp/app/shared/.gitkeep` |
| `[keep]` | | `packages/webapp/app/i18n/.gitkeep` |
| `[keep]` | | `packages/webapp/app/@types/.gitkeep` |
| `[keep]` | | `packages/webapp/public/.gitkeep` |

## Phase 5 — Devcontainer — conditional on `has_devcontainer`

| Layer | Template | Output path |
|---|---|---|
| `[devcontainer]` | `devcontainer/devcontainer.json.tmpl` | `.devcontainer/devcontainer.json` |
| `[devcontainer]` | `devcontainer/docker-compose.yml.tmpl` | `.devcontainer/docker-compose.yml` |
| `[devcontainer]` | `devcontainer/Dockerfile.tmpl` | `.devcontainer/Dockerfile` |

## Phase 6 — CI — conditional on `has_gitlab_ci`

| Layer | Template | Output path |
|---|---|---|
| `[ci]` | `ci/.gitlab-ci.yml.tmpl` | `.gitlab-ci.yml` |

## Phase 7 — Production Dockerfile — conditional on `has_dockerfile` AND `has_webapp`

| Layer | Template | Output path |
|---|---|---|
| `[docker]` | `ci/Dockerfile.tmpl` | `packages/webapp/Dockerfile` |

## Phase 8 — Auth overlay — conditional on `auth_mode == "operator-session"`

Overlay AFTER all base templates are written. These files either create new paths or modify generated files; the manifest assumes base has been written first.

| Layer | Template | Output path |
|---|---|---|
| `[auth]` | `auth-operator-session/webapp/app/shared/utils/requireOperatorSessId.ts.tmpl` | `packages/webapp/app/shared/utils/requireOperatorSessId.ts` |
| `[auth]` | `auth-operator-session/AUTH_NEXT_STEPS.md.tmpl` | `AUTH_NEXT_STEPS.md` |

**Note on cookies**: `packages/webapp/app/cookies.server.ts` is in the base webapp phase. When `auth_mode == "none"`, it's a stub with TODO; when `auth_mode == "operator-session"`, it's fully wired. The skill picks the right template variant by inspecting `auth_mode` BEFORE writing — there are two variants:
- `webapp/app/cookies.server.ts.tmpl` — stub (default)
- `auth-operator-session/webapp/app/cookies.server.ts.tmpl` — wired version

When `auth_mode == "operator-session"` AND `has_webapp`, use the auth-overlay cookies.server.ts template instead of the base one.

## Phase 9 — Finalize

1. Run `git init` in `{{target_dir}}` via `Bash`.
2. Print the post-generation checklist (see SKILL.md Step 4).

Do NOT run `pnpm install`. Do NOT run `git add`/`git commit`. Do NOT start dev servers.
