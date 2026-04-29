---
name: scaffold-project
description: Scaffolds a new hexagonal-architecture monorepo with @efesto-cloud/* libraries — core (domain), mongodb (persistence), webapp (React Router 7 admin). Use this skill whenever the user wants to bootstrap, scaffold, initialize, or start a new project with pnpm workspaces + TypeScript + Inversify DI + MongoDB + React Router, or mentions "new monorepo", "new backend", "new admin app", "scaffold", or "project skeleton", even if they don't explicitly ask for "scaffold-project". The skill interviews the user, then writes a ready-to-install skeleton; it does NOT generate domain content (entities, use cases) — those are handled by separate specialized skills (`entity`, `value-object`, `usecase`, `persistence`, `mongodb-persistence`, `prisma-persistence`, `population`, `mongodb-population`, `prisma-population`, `type-enum-dict`, `webapp-loader-action`, `daisyui`).
---

# Scaffold Project

Generate a new project skeleton on disk. The skeleton is empty but fully wired: every package compiles, the DI container boots, and `/` serves hello-world. From there the user hands off to domain-specific skills.

## Workflow overview

1. **Interview** — ask the user in batches (see `references/interview.md`).
2. **Confirm** — show the resolved config + file tree, ask "proceed or revise".
3. **Generate** — for each selected layer, read `.tmpl` files from `assets/`, substitute placeholders, write with the `Write` tool.
4. **Print checklist** — next-step commands and which specialized skill to invoke next.

## Guardrails

Read these before writing anything:

- **Never invent template content.** Every file comes from `assets/`. If a template does not exist for a requested combination, emit a `TODO(scaffold):` comment in the generated file and move on.
- **Do not run `pnpm install`.** The user does this themselves.
- **Do not run `git commit`, start servers, or trigger CI.** The skeleton ships un-committed so the user can inspect it.
- **Do not create domain content** — no entities, use cases, repo implementations, DTOs, value objects. The `entity`, `usecase`, `persistence`, etc. skills own those surfaces.
- **Do not deviate from Oasis conventions** — pnpm (not npm/yarn), Biome (not ESLint/Prettier), TypeScript `nodenext` with `~/*` alias and `.js` import extensions. These are non-negotiable (see `references/conventions.md`).
- **Placeholders are literal.** `{{ns}}`, `{{project_name}}`, etc. Do string-replace the whole token, don't "interpret" it.

## Step 1 — Interview

Use `AskUserQuestion` in batches of ≤4. Follow `references/interview.md` for the exact questions, defaults, and branching. The four batches are:

1. **Identity & namespace** (project name, target dir, `@ns` scope, description)
2. **Layers** (persistence? webapp? devcontainer? CI?)
3. **Webapp specifics** — skipped if no webapp (auth mode, UI stack, locale, timezone)
4. **Final confirm** — preview + proceed/revise

If the user asks to revise, re-enter the relevant batch only. Do not re-ask settled questions.

## Step 2 — Confirm

Render a preview block like:

```text
Project:       {{project_name}}
Target:        {{target_dir}}
Namespace:     {{ns}}
Layers:        core, mongodb, webapp
Auth:          none
Locale/TZ:     it-IT / Europe/Rome
Infra:         devcontainer, gitlab-ci, dockerfile

Will create ~40 files. Proceed?
```

Wait for confirmation. Do not proceed without it.

## Step 3 — Generate

Resolve placeholders up front into a single config object:

```text
ns            → e.g. "@acme"                (user answer)
project_name  → e.g. "acme-app"             (user answer)
description   → e.g. "Acme admin"           (user answer)
has_mongodb   → true | false
has_webapp    → true | false
auth_mode     → "none" | "operator-session" | "skip-with-todo"
locale        → "it-IT" | "en-US" | custom
timezone      → "Europe/Rome" | "UTC" | custom
has_devcontainer, has_gitlab_ci, has_dockerfile → booleans
```

Walk `references/file-manifest.md` top-to-bottom. For each entry:

1. Read `assets/<relative-path>.tmpl`
2. Substitute placeholders (plain string replace — `{{ns}}` → value, etc.)
3. Resolve `{{#if has_x}}...{{/if}}` blocks: keep content if flag is true, remove the block (and its markers) if false. Nested ifs are not supported — keep templates flat.
4. `Write` to `<target_dir>/<output-path>` (drop `.tmpl` suffix)

**Empty dirs**: for every `src/` subfolder listed in the manifest, write a `.gitkeep` so git tracks the directory tree.

**Auth overlay**: if `auth_mode == "operator-session"`, AFTER the base templates, overlay `assets/auth-operator-session/**` files. These add webapp-side plumbing only (cookies, session utils). They also emit `AUTH_NEXT_STEPS.md` at the project root that tells the user to invoke the `entity` skill for `Operator` and the `usecase` skill for `LoginOperator`/`LogoutOperator`.

**Git init**: run `git init` in `<target_dir>` at the very end. Do nothing else with git.

## Step 4 — Checklist

Print exactly:

```text
✓ Project created at {{target_dir}}

Next steps:
  cd {{target_dir}}
  pnpm install
  pnpm -r typecheck                 # should pass on empty skeleton
  pnpm -r build                     # should pass on empty skeleton
{{#if has_webapp}}  cd packages/webapp && pnpm dev   # hello-world at http://localhost:3000{{/if}}

Then build domain content with the existing skills:
  • entity               — add your first entity
  • value-object         — wrap primitives with validation
  • type-enum-dict       — finite state sets
{{#if has_mongodb}}  • persistence          — MongoDB repo implementations{{/if}}
  • usecase              — business operations
{{#if has_webapp}}  • webapp-loader-action — expose operations over HTTP
  • daisyui              — UI components{{/if}}
{{#if auth_mode == operator-session}}

Auth is partially wired. See AUTH_NEXT_STEPS.md for the entity + usecase hand-off.{{/if}}
```

## References

- `references/interview.md` — full question bank + branching rules
- `references/file-manifest.md` — ordered file list per layer (READ THIS BEFORE WRITING)
- `references/package-matrix.md` — `@efesto-cloud/*` dependency matrix
- `references/conventions.md` — naming, imports, DI patterns (Oasis invariants)

## Placeholder glossary

| Placeholder | Where filled | Example |
|---|---|---|
| `{{ns}}` | Batch 1 Q3 | `@acme` |
| `{{project_name}}` | Batch 1 Q1 | `acme-app` |
| `{{description}}` | Batch 1 Q4 | `Acme admin console` |
| `{{locale}}` | Batch 3 Q11 | `it-IT` |
| `{{timezone}}` | Batch 3 Q12 | `Europe/Rome` |
| `{{auth_mode}}` | Batch 3 Q9 | `none` / `operator-session` / `skip-with-todo` |
| `{{has_mongodb}}` | Batch 2 Q5 | boolean |
| `{{has_webapp}}` | Batch 2 Q6 | boolean |
| `{{has_devcontainer}}` | Batch 2 Q7 | boolean |
| `{{has_gitlab_ci}}` | Batch 2 Q8 | boolean |
| `{{has_dockerfile}}` | Batch 2 Q8 | boolean |

## What to do if something is ambiguous

If the interview answers leave a template variable undefined, stop and ask one clarifying `AskUserQuestion` rather than guessing. Do not fabricate defaults silently.

If a user insists on a stack choice outside Oasis invariants (npm, yarn, ESLint, Prettier, Jest over Vitest, …), push back once explaining the conventions, then honor their choice only if they confirm. Note any deviation in a `README.md` section "Conventions deviations" so future skills know.
