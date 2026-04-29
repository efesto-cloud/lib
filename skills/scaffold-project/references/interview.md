# Interview — Full Question Bank

Drive all questions via `AskUserQuestion`, in batches of ≤4. Keep options short; always include a default. Batches 2 and 3 may be skipped per rules below.

---

## Batch 1 — Identity & namespace (always asked, 4 questions in one call)

### Q1. Project name
- **Header**: `Project name`
- **Question**: `What is the name of the new project? (Used as the root directory name and as a prefix in package.json.)`
- **Input type**: free text
- **Default**: none — user must answer
- **Constraints**: kebab-case, no spaces. If the answer has spaces or uppercase, lowercase + replace spaces with `-` and confirm.

### Q2. Target directory
- **Header**: `Target directory`
- **Question**: `Where should the project be generated? (Absolute path or relative to CWD.)`
- **Default**: `./{{project_name}}`
- **Validation**: if the directory exists and is non-empty, stop and ask user to delete it or pick a new path — NEVER overwrite.

### Q3. Package namespace
- **Header**: `Namespace`
- **Question**: `What npm scope should the workspace packages use?`
- **Options**:
  - `@{{project_name}}` (default, derived from Q1)
  - `Other` — free text
- **Format**: must start with `@`, no slashes, lowercase.

### Q4. Description
- **Header**: `Description`
- **Question**: `One-line description of the project (goes into the root package.json and README).`
- **Default**: none — prompt for text
- **Used in**: `package.json#description`, `README.md` title line

---

## Batch 2 — Layers (always asked, 4 questions)

### Q5. Persistence
- **Header**: `Persistence layer`
- **Question**: `Include a MongoDB package?`
- **Options**:
  - `Yes — MongoDB` (default)
  - `No — core only`
- Sets `has_mongodb`.

### Q6. Webapp
- **Header**: `Web application`
- **Question**: `Include a React Router 7 admin webapp?`
- **Options**:
  - `Yes — admin webapp` (default)
  - `No — backend only`
- Sets `has_webapp`.

### Q7. Devcontainer
- **Header**: `Dev environment`
- **Question**: `Generate a VS Code devcontainer with Docker Compose (MongoDB service included)?`
- **Options**:
  - `Yes` (default)
  - `No`
- Sets `has_devcontainer`. If `has_mongodb == false`, the compose file only has the app service.

### Q8. CI and Docker
- **Header**: `CI / Docker`
- **Question**: `Generate CI pipeline and production Dockerfile?`
- **Options**:
  - `Both — GitLab CI + Dockerfile` (default)
  - `GitLab CI only`
  - `Dockerfile only`
  - `Neither`
- Sets `has_gitlab_ci`, `has_dockerfile` accordingly.

**Important**: only GitLab CI is supported in v1. If the user asks for GitHub Actions, tell them "not supported in v1 — emit empty stub with TODO", and proceed only if they confirm.

---

## Batch 3 — Webapp specifics (SKIP if `has_webapp == false`)

### Q9. Auth scaffolding
- **Header**: `Authentication`
- **Question**: `What authentication scaffolding should be generated?`
- **Options**:
  - `None` (default) — public admin, no session checks
  - `Operator-session` — cookies + session utils + AUTH_NEXT_STEPS.md (you will later run `entity` and `usecase` skills to complete it)
  - `Skip with TODO` — leaves `TODO(auth)` comments in strategic places
- Sets `auth_mode`.

### Q10. UI stack
- **Header**: `UI stack`
- **Question**: `Which CSS / component layer should be wired?`
- **Options**:
  - `DaisyUI v5 + Tailwind v4` (default)
  - `Tailwind v4 only`
  - `Plain CSS`
- Sets `ui_stack`.

### Q11. Locale
- **Header**: `Locale`
- **Question**: `Default application locale?`
- **Options**:
  - `it-IT` (default)
  - `en-US`
  - `Custom` — free text (e.g. `fr-FR`)
- Sets `locale`. Used in Luxon `Settings.defaultLocale` and server HTML `<html lang>`.

### Q12. Timezone
- **Header**: `Timezone`
- **Question**: `Default application timezone?`
- **Options**:
  - `Europe/Rome` (default)
  - `UTC`
  - `Custom` — free text (e.g. `America/New_York`)
- Sets `timezone`. Used in Luxon `Settings.defaultZone`.

---

## Batch 4 — Final confirm (always asked, 1 question)

### Q13. Confirm
Render a config preview like:

```text
Project:       {{project_name}}
Target:        {{target_dir}}
Namespace:     {{ns}}
Description:   {{description}}

Layers:        core {{#if has_mongodb}}+ mongodb{{/if}} {{#if has_webapp}}+ webapp{{/if}}
Auth:          {{auth_mode}}
UI stack:      {{ui_stack}}
Locale / TZ:   {{locale}} / {{timezone}}
Infra:         {{#if has_devcontainer}}devcontainer{{/if}}{{#if has_gitlab_ci}}, gitlab-ci{{/if}}{{#if has_dockerfile}}, dockerfile{{/if}}

~N files will be written. Continue?
```

- **Header**: `Confirm scaffold`
- **Options**:
  - `Proceed` (default)
  - `Revise batch 1` (identity)
  - `Revise batch 2` (layers)
  - `Revise batch 3` (webapp) — only if Batch 3 was asked
  - `Cancel`

On revise, re-enter only that batch. Do not re-ask settled questions from prior batches.

On cancel, write nothing. Stop the skill.

---

## Branching rules summary

| Condition | Effect |
|---|---|
| `has_webapp == false` | Skip Batch 3. Set `auth_mode = "none"`, `ui_stack = n/a`, `locale/timezone` unused. |
| `has_mongodb == false` | Docker Compose omits `mongo` service. `install.ts` / `init.ts` / `MongoSymbols.ts` not generated. Webapp `server.mjs` does NOT `container.load(install())`. |
| `auth_mode != operator-session` | Do not overlay `auth-operator-session/`. Do not emit `AUTH_NEXT_STEPS.md`. |
| `has_devcontainer == false` | Skip `.devcontainer/` entirely. |
| `has_gitlab_ci == false` | Skip `.gitlab-ci.yml`. |
| `has_dockerfile == false` | Skip `packages/webapp/Dockerfile`. |

---

## Notes on AskUserQuestion mechanics

- Batch 1 has 4 sub-questions — submit them together in one `AskUserQuestion` call with 4 questions.
- Batches 2 is 4 sub-questions, also one call.
- Batch 3 is 4 sub-questions, one call.
- Batch 4 is 1 question.
- This puts the full interview at 4 tool calls (3 if no webapp).
- Do not re-prompt for things the user already answered clearly — only use clarifying prompts when the answer is ambiguous or fails validation.
