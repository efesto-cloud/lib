# CRM ITEC → Blueprint: materiale da processare

Tutto quello che il CRM ITEC (`thera-capital/crm-itec`) ha da dare al Blueprint,
buttato qui per sistemarlo dopo. **Non è ancora processato**: le divergenze col
Blueprint sono attese.

Codice, ADR e README sono presi da `dev` a `d1c85da` (15/11/2026), dopo le epic
#41 (prime pratiche), #93 (permessi), #96, #97 e #146: è la forma che il CRM ha
dopo aver applicato le osservazioni. I numeri `#…` sono issue di quel repo.

## Da dove partire

1. **[registro.md](registro.md)**: le osservazioni di Dario su #78 (11/11), le
   decisioni Q1–Q17, il confronto punto per punto col Blueprint di questo branch
   (A = c'è ma non seguito, B = diverso, C = manca), e in fondo come è andata nel
   CRM dopo #88/#89.
2. **[issue/](issue/)**: i corpi delle issue che hanno applicato le decisioni.
   - #90 le cartelle `apps/`, `packages/`, `adapters/`;
   - #88 la forma del contract: input come schemi zod nel file dello use case,
     `I<Entità>`, errori nativi di better-result, container nella composition
     root;
   - #89 entity con `v`, una sola `save`, Unit of Work, install per adapter;
   - #93/#94 i permessi per azione e le policy applicate dal resolver.
3. **[adr/](adr/)**: le decisioni come sono state scritte nel CRM. 0009 (contratto
   e core), 0010 (cartelle e dipendenze), 0011 (il patto del save e la Unit of
   Work), 0013 (policy nel resolver) sono le più vicine al Blueprint; 0002, 0012,
   0014 per contesto.
4. **[CLAUDE.md](CLAUDE.md)** e **[codice/README.md](codice/README.md)** e i
   README di core e contract: le ricette corte («come si aggiunge»). Sono il
   candidato per ciò che il Blueprint copia nel repo al setup (Q16).
5. **[preflight-88-89.html](preflight-88-89.html)**: il riepilogo visto prima di
   partire con #88/#89.

## Il codice d'esempio (`codice/`)

Una fetta verticale, con i percorsi del repo:

| cosa | file |
| --- | --- |
| base dell'entity, nel core | `packages/core/src/entity/Entity.ts` |
| un'entity | `packages/core/src/entity/Cliente.ts` |
| porta della repository e Unit of Work | `packages/core/src/repo/IClienteRepository.ts`, `IUnitOfWork.ts` |
| install del core e resolver | `packages/core/src/di/` |
| policy per use case | `packages/core/src/auth/` |
| modulo e use case | `packages/core/src/useCase/clienti/` |
| contract: input zod, interfacce `I…`, errori, registro | `packages/contract/src/` |
| adapter D1: Unit of Work, repository, install | `adapters/d1-adapter/src/` |
| composition root e parse al bordo | `apps/webapp/workers/bootstrap.ts`, `apps/webapp/app/input.server.ts` |
| il test del patto del save | `apps/webapp/test/salvataggio.test.ts` |
