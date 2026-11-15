---
status: accepted
---

# Ruoli e BU come due assegnazioni distinte dell'utente

Nell'HTML di LZ un utente ha i ruoli **per BU**: `roleBu = { ruolo: [BU] }`.
Si può essere BP su Security e PM/BO su Antincendio. LZ ci è arrivato da un
modello precedente, con `roles[]` e `bu[]` separati, e ha scritto una
migrazione apposta (`migrateRoleBu`). Il motivo non è scritto. Fino a #113
il nostro CRM ha copiato `roleBu`: una riga per coppia ruolo-BU.

Nell'export di LZ del 4 settembre 2026 (`data.json`, non versionato) i 27
utenti con ruoli hanno ognuno **ogni ruolo su tutte le BU**. L'unica
eccezione è un PM solo su Antincendio che però è BO su tutte e tre, e con la
fusione di BO in PM/BO diventa uguale agli altri. Il legame ruolo-BU non lo
usa nessuno.

**Ruoli e BU sono due insiemi distinti dell'utente, e ogni suo ruolo vale su
ognuna delle sue BU.** Copre chi lavora solo su alcune BU (un BP solo su
Security) senza la griglia. In base dati sono due tabelle,
`RuoloUtente(utente, ruolo)` e `BuUtente(utente, bu)`. La migrazione prende
come BU di ogni utente l'unione di quelle che aveva su un ruolo qualsiasi.

Con questa forma la regola dei permessi sta nelle entità, e il servizio
`IPermessi` non serve più:

- **`Pratica`**, la base di `Offerta` e `Commessa`, dice con `ruoliDi(utente)`
  quali ruoli dell'utente valgono su di lei: nessuno se la sua BU non è fra
  quelle dell'utente, e il PM/BO solo se è in squadra. `Pratica.daCreare(bu,
  squadra)` fa lo stesso per la pratica da creare. Con `ammette(utente,
  ruolo)` dice chi può entrare in squadra.
- **`Matrice`**, la tabella `Permesso` letta dalla sua repository, dice con
  `consente(utente, azione, pratica)` se uno dei ruoli che valgono sulla
  pratica ha l'azione, o se l'utente è Amministratore; con `filtro(utente,
  azione)` dove l'utente ha l'azione, per gli elenchi.

Le policy, i percorsi e gli elenchi usano questi due metodi.

## Le alternative scartate

- **Tenere `roleBu`.** È l'HTML, ma nessuno lo usa, e porta una griglia
  nella pagina Utenti e una coppia in ogni controllo.
- **Niente BU sull'utente.** È la cosa più semplice e coincide con i dati di
  oggi. Ma non sa dire «questo BP lavora solo su Security», che ITEC può
  chiedere.
- **Il servizio `IPermessi`** con `check(utente, azione, Offerta | Commessa |
  Portata)`. Mescolava entità e valori, e per sapere la squadra faceva
  `instanceof`. Inoltre la regola stava in `rule/`, che l'ADR 0009 riserva
  alle regole che servono anche al browser.

## Le conseguenze che vale la pena conoscere

- **Ruoli diversi su BU diverse non si possono più dire.** Se un giorno
  servisse, si torna alla coppia ruolo-BU.
- **Un utente che non è Amministratore ha almeno un ruolo e una BU**: senza,
  non potrebbe fare niente (`UtenteWithoutRuoloError`).
- **I claim del JWT cambiano forma** (ADR 0012), insieme a `IUtente`.

Contesto: #113, dalla review della PR #111 con Dario, il 12 novembre 2026.
