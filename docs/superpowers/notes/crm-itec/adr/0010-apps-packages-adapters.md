---
status: accepted
---

# Il monorepo in `apps/`, `packages/` e `adapters/`

Gli adattatori stavano dentro chi li usava: le repository D1 nel Worker della
webapp, Arca su SQL Server e il canale HTTP nella sonda, un'Arca finta nel core
e un'altra nel seed della webapp. Dalle cartelle non si capiva cosa fosse
dominio, cosa adattatore e cosa applicazione. Il workspace ora ha tre cartelle,
sul modello di `efesto-cloud/agent`:

- **`apps/`**: le composition root, cioè `webapp` e `sonda`. Scelgono gli
  adapter, li legano alle porte del core e sanno dove stanno configurazione e
  segreti.
- **`packages/`**: `contract`, `core`, `db` e `legacy`.
- **`adapters/`**: un pacchetto per tecnologia, `@itec/<tecnologia>-adapter`,
  che implementa le porte del core (`d1-adapter`, `sqlserver-adapter`,
  `http-adapter`). `stub-adapter` tiene i dati finti: l'Arca dello stub e
  quella, più grande, del seed locale.

**La regola delle dipendenze**: app → adapter → core e contract; core →
contract. Nessuno importa un'app, e un adapter non importa un altro adapter.
I test seguono la stessa regola: quelli del core usano i falsi di
`core/src/_testing`, e quelli di un adapter da solo stanno nel suo pacchetto.
Le repository D1 e il seed si provano nel runtime dei Worker, quindi dalla
webapp.

Gli adapter si compilano in `dist`, come il core: la sonda parte con
`node src/index.ts`, ma nell'immagine le sue dipendenze stanno in
`node_modules`, dove Node non toglie i tipi.
