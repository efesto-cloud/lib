---
"@efesto-cloud/result-codec": major
---

Nuovo package: valida i Result che attraversano un confine serializzato
(loader/action di React Router, code, persistenza) usando validatori
Standard Schema, uno per ramo per direzione.

`deserialize` restituisce un Result la cui unione d'errore include
`DecodeError` accanto agli errori di dominio: schema cambiato, versioni
disallineate o payload corrotto si distinguono dall'esito di dominio per
tag, e si gestiscono con lo stesso `matchError`. Con `taggedErrorSchema`
le istanze d'errore vengono ricostruite lato client, cosi' il match
esaustivo funziona identico ai due capi della rete.

Il codec e' sincrono: il client deserializza durante il render.
