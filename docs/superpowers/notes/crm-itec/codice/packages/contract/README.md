# @itec/contract

Il bordo del CRM verso chi lo chiama (vedi `docs/adr/0009`): le interfacce
degli use case con `UseCase<I, R>` e `ExecutionContext`, il registro, gli
errori con tag, i tipi e gli enum, e il canale della sonda: gli schemi zod dei
payload di `/api/sonda/*` e il formato della firma HMAC, con cui firma la
sonda e verifica il Worker.

- **L'input di uno use case** è uno schema zod nel file della sua interfaccia
  (`useCase/utenti/ICreateUtente.ts`), con lo stesso nome per schema e tipo:
  `export const CreateUtenteInput = z.object(…)` e
  `export type CreateUtenteInput = z.infer<typeof CreateUtenteInput>`. Lo usa
  chi chiama, solo dove entra un dato grezzo; lo use case non rivalida.
- **Ciò che esce** per un'entità è un'interfaccia in `interface/`,
  `I<Entità>` (`IUtente`), non uno schema.
- **`type/`** tiene le union e le struct semplici (`ProbeState`, `RuoloBu`).
- **Un errore** è un `TaggedError` di better-result:
  `class XError extends TaggedError("XError")<{ campi }> {}`, con il tag
  uguale al nome della classe.

Non dipende dal core. Le route React della webapp importano solo da qui.

Si compila in `dist/` come il core, e prima di lui; si importa per percorso
(`@itec/contract/sonda/Heartbeat`).
