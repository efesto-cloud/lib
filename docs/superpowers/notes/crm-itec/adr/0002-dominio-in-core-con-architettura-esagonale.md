---
status: accepted
---

# Il dominio sta in `packages/core`, con l'architettura esagonale delle altre repo Thera

Nell'HTML consegnato il dominio (commesse, offerte, RFQ, utenti, ruoli per
business unit, fasi e permessi di avanzamento) è mescolato all'interfaccia e al
salvataggio su file, in un solo script.

La decisione è che tutto il dominio si sposta in **`packages/core`**, con la
stessa architettura delle altre repo Thera: entità, value object, use case e
porte in `core`, costruiti sulle librerie `@efesto-cloud/*` (Entity, Result,
Maybe, Usecase) con Inversify per la DI; database e servizi esterni restano
fuori, dietro adattatori. Il core è il cuore del nostro CRM (vedi
[0005](0005-un-solo-binario-il-nostro-crm-a-parita-progressiva.md)): la webapp lo usa, e il core
non dipende né dalla webapp né dalla sonda.

## Le conseguenze che vale la pena conoscere

- **D1 è un adattatore**, non una dipendenza del dominio: il repository del
  core è implementato su Prisma e sullo schema di `packages/db`. È questo che
  rende sostituibile il database, e con lui il posto in cui il CRM gira.
- **Le regole si estraggono dall'HTML legacy e non si reinventano**: le fasi
  (da `in_redazione` a `conclusa`), la matrice dei permessi per ruolo e la
  mappa dei conti di costo di Arca sono il comportamento che il cliente sta
  già provando.
- **Il riuso che si è immaginato per altri clienti passa da qui.** Il 31 agosto
  si è stimato che circa l'80% del CRM sia riusabile altrove: è il core, non
  l'interfaccia, a doverlo rendere possibile.

Contesto: `thera/projects/crm-itec.md` e `thera/projects/thera-tech.md` nel
repository `context`; decisione del 29 settembre 2026.
