# CLAUDE.md

Guida per Claude Code / agenti che lavorano su questa repository. Cos'è e
com'è fatto il progetto: [`README.md`](README.md).

## Lingua

Codice, commenti, documentazione e messaggi di commit sono in **italiano**, con
piena correttezza ortografica (accenti inclusi). Identificatori e termini
tecnici restano nella forma originale. Fa eccezione `docs/agents/`, che segue i
template condivisi di Thera ed è in inglese.

## Codice ereditato

`packages/legacy/` e `apps/sonda/legacy-python/` sono arrivati da LZ così
come sono, e l'HTML è in prova presso il cliente.

- **L'HTML è la specifica di riferimento** (docs/adr/0005), non
  un'applicazione da portare: le regole di dominio si estraggono da lì e non si
  reinventano, e il nostro CRM cresce fino a una parità approssimativa con lui.
  Non si modifica e non si pubblica.
- **Ogni versione nuova di LZ** sostituisce `ITEC_CRM.html` in un commit a sé,
  con la data di consegna nel messaggio, e un'issue registra cosa cambia nel
  dominio. La storia del file è lo storico delle versioni.
- **`CLAUDE_Contesto_CRM_ITEC.md`** è il contesto di LZ, conservato com'è:
  dove contraddice l'HTML, vale l'HTML.
- **Lo schema del database** (`packages/db`) segue il dominio, non la forma del
  JSON di LZ.
- **Il Python** si riscrive in Node.js (#3) e non si estende.

## Dati e segreti

- **Mai** versionare `arca_extract_config.json`, `itec_crm_db.json`, gli
  snapshot Excel di Arca, né password, token o dati del cliente. Il
  `.gitignore` copre i nomi noti: controlla comunque cosa stai aggiungendo.
- Le **coordinate** di accesso (server, indirizzi, porte, nomi utente) invece
  si versionano, e tutte in un posto solo: [`docs/arca/mappa.html`](docs/arca/mappa.html).
- `packages/legacy/ITEC_CRM.html` contiene un seed (utenti e commesse d'esempio) com'è
  stato consegnato: non aggiungerne altro.

## Monorepo

pnpm, scope `@itec/`, tre cartelle (docs/adr/0010). Un solo binario: il
nostro CRM, costruito per incrementi funzionanti.

- `apps/`, le composition root: `webapp`, l'app React Router 8 su Cloudflare
  Worker, e `sonda`, Node.js headless in Docker nella rete ITEC che porta i
  dati di Arca nel database;
- `packages/`: `contract` e `core`, il bordo verso chi chiama e il dominio
  esagonale (docs/adr/0009); `db`, schema Prisma su D1 e migrazioni; `legacy`,
  il CRM di LZ, versione per versione, come specifica;
- `adapters/`, un pacchetto per tecnologia che implementa le porte del core:
  `d1-adapter`, `sqlserver-adapter`, `http-adapter` e `stub-adapter` (le
  Arche finte).

Le dipendenze vanno app → adapter → core e contract, core → contract: nessuno
importa un'app, nessun adapter importa un altro adapter, e i test del core non
importano adapter.

Perché così: [`docs/adr/`](docs/adr/).

## Nomi

- **Il dominio è in italiano, ovunque**: entità del core e tabelle del database
  hanno lo stesso nome, il termine del glossario (`Commessa`, `Sottocommessa`,
  `Cliente`, `RagioneSociale`). Una cosa ha un nome solo.
- **Gli attributi del nostro database sono in snake_case** (`codice_arca`,
  `livello_budget`); le tabelle in PascalCase.
- **Lo specchio di Arca tiene i nomi di Arca** così come sono (`ArcaDOTes`,
  `Cd_CF`, `Id_DoTes`).
- **La parte tecnica è in inglese** e dice cosa fa: use case, porte, servizi
  (`ISyncArcaToCloud`, `ArcaErp`, `CloudPush`). Gli use case non hanno
  suffisso, né `UseCase` né `UC`.

## Agent skills

### Issue tracker

GitHub Issues on `thera-capital/crm-itec`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Implement

Always in a worktree under `.claude/worktrees/`; an epic step closes with a `--no-ff` merge into the epic's integration branch, the epic itself (and any standalone issue) with a pull request; sessions are ephemeral, so what matters goes into the tracker; the `claude -p` prompt template is there. See `docs/agents/implement.md`.

### Triage labels

The default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and one `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Product context

Meetings, the project sheet, people and client decisions live in `thera-capital/context`. See `docs/agents/product-context.md`.

## Git Workflow

Three long-lived branches, one per stage (docs/adr/0007):

```
feat/* ──PR──▶ dev ──PR──▶ staging ──PR──▶ main
```

- **`dev`** is where daily work lands. CI checks it; it deploys nowhere.
- **`staging`** receives pull requests **from `dev` only**, and every merge deploys the staging environment (`crm-itec-staging`).
- **`main`** is production. It receives pull requests **from `staging` only**, and every merge deploys production. The human approval is that pull request: there is no second gate.

Nobody commits to `staging` or `main` directly, and nothing skips a stage: what reaches production is exactly what staging ran.

**Keep the three in step — this is the maintenance the flow costs, and every merge has to keep it in mind:**

- A `hotfix/*` branches from `main`, because that's what production runs. Once it's in `main`, **bring it back into `staging` and `dev` right away**: a fix left behind comes back with the next promotion and undoes itself.
- **Hotfixes carry no migrations**, unless the pull request says so explicitly. A migration born on `main` splits the migrations folder, and the next promotion breaks.
- **Promote on a rhythm**, for example at every closed epic step. A stale `staging` turns the next release into a big jump.

### Branch naming

```
<type>/<issue number>-<slug>
```

The number is there whenever an issue exists, right after the type. It is the only stable handle — slugs drift, issue numbers don't — and it pairs the branch with its worktree: `.claude/worktrees/ticket-77` ↔ `feat/77-<slug>`. Without an issue, omit it: `docs/<slug>`.

**Types**, eight, closed:

| type | for |
| --- | --- |
| `feat` | new behaviour |
| `fix` | a defect in `dev` |
| `hotfix` | a defect in production — **branches from `main`**, then goes back into `staging` and `dev` |
| `refactor` | same behaviour, different shape |
| `chore` | build, deps, formatting, housekeeping |
| `docs` | documentation only |
| `spike` | an experiment that is not meant to be merged |
| `epic` | an integration branch, see below |

**The slug**: two to four words, lowercase, hyphens, no accents, Italian like the rest of the project. It names the *outcome*, not the mechanism — `import-ordini-arca` or `permessi-per-business-unit`, not `fix-html` or `modifica-arca-extract`.

**Epics** take their own type, on the map issue's number: `epic/84-<slug>`. It isn't cosmetic — the merge rules fork there. Steps merge *into* it; the epic itself leaves as a pull request. Steps stay flat, `feat/77-<slug>`, and it's the map that lists which ones belong to the epic, not `git branch`.

**A branch named `worktree-*` is a process bug.** Creating a worktree derives a branch name from the worktree's name; rename it immediately, before the first commit.

This convention applies from now on. Existing branches keep their names.

### Pull request

Ogni modifica passa da una PR. Niente commit diretti su `dev`, `staging` o
`main`, niente merge da soli: il merge è sempre dell'umano. Anche le promozioni,
da `dev` a `staging` e da `staging` a `main`, sono PR.
