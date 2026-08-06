# Decisioni rimandate — da riprendere con calma

Appunti presi il 2026-08-06, a valle delle Fasi A/B/C (branch
`feat/tagged-error-and-combinators`, non ancora mergiato). Nessuna delle due
voci qui sotto è bloccante per quel branch: sono decisioni di design che
conviene prendere lucidi, non in coda a un rilascio.

---

## 1. `taggedErrorSchema` valida il tag, non i props

### Il fatto

`taggedErrorSchema(...classi)` in `@efesto-cloud/tagged-error` verifica che
`_tag` corrisponda a una delle classi passate e poi costruisce
`new Cls(value)` sull'oggetto grezzo. **I props non vengono validati.**

Conseguenza dimostrata in review: un server disallineato che manda
`{ _tag: "FooForbidden" }` senza il props `motivo` produce un `Failure` con
un'istanza vera di `FooForbidden` il cui `motivo` è `undefined` **pur essendo
tipizzato `string`**. Il componente crasha tre livelli più in là, con uno
stack che non punta al confine.

È esattamente il guasto che `@efesto-cloud/result-codec` esiste per
intercettare — «il payload non è quello che ci aspettavamo» — e passa in
silenzio proprio con l'helper che il changelog raccomanda.

Oggi è documentato come limite noto nei README di `tagged-error` e
`result-codec`. Non è corretto.

### Come lo ha risolto better-result

Non lo ha risolto: **non offre la scorciatoia**. In
[dmmulroy/better-result](https://github.com/dmmulroy/better-result) non
esiste alcun `taggedErrorSchema`. `Result.codec` prende gli stessi quattro
schemi che prendiamo noi, ma il `DomainErrorFromWireSchema` te lo scrivi tu,
e la documentazione è esplicita: *«keep validation and domain/wire mapping
inside those schemas»*. Non essendoci una strada che salti la validazione,
il buco non si può aprire.

È la stessa conclusione della nostra spec al § 5.5, dove `taggedErrorSchema`
è definito «uno degli schemi che puoi passare nello slot `deserialize.err`,
non il meccanismo». Nella pratica poi tutti i test e il changeset lo usano
come default, e il ridimensionamento si è perso per strada.

### Le tre opzioni

1. **Lasciare com'è**, documentato. Costo zero oggi, il guasto resta latente.
2. **Rimuoverlo**, come better-result. Onesto, ma butta via la comodità anche
   dove è innocua.
3. **Renderlo sicuro per costruzione.** Il buco si apre **solo** per le classi
   che dichiarano props: `taggedErrorSchema(FooNotFound)` con `FooNotFound`
   senza props è già sicuro, non c'è niente da validare. Si può quindi
   esprimere come vincolo di tipo — classe nuda se non ha props, classe più
   schema dei props se li ha:

   ```ts
   taggedErrorSchema(NotFound, [Forbidden, z.object({ motivo: z.string() })]);
   //                 ^ nessun props        ^ props dichiarati -> schema obbligatorio
   ```

   Serve un tipo condizionale che distingua `InstanceType<C>` con props da
   `InstanceType<C>` senza, sopra `TaggedErrorBase & { _tag, name }`.

**Propensione:** la 3. Il compilatore chiude il caso pericoloso e la comodità
resta dov'è innocua, invece di affidare la sicurezza a una riga di README.
`tagged-error` non ha ancora rilasciato l'1.0.0, quindi renderlo obbligatorio
adesso non rompe nessuno. Da verificare che il tipo condizionale sia
scrivibile senza diventare illeggibile — se non lo è, ripiegare sulla 2.

---

## 2. Ridisegnare `@efesto-cloud/env`

### Perché

Due ragioni, una di API e una di rilascio.

**API.** La forma attuale è `EnvKey.integerSafe("PORT")`: chiave come
argomento, un metodo per tipo, moltiplicato per due varianti (safe e
lanciante). Fa 14 metodi per 7 tipi, e ogni tipo nuovo ne aggiunge due.
`process.env` è cablato dentro il modulo, quindi non si può testare senza
mutare un globale. E c'è una `Map` di cache a livello di modulo che non si
invalida mai: un test che scrive `process.env.X` dopo la prima lettura legge
il valore vecchio.

**Rilascio.** `env` espone `Result` nella propria API pubblica, ma il
changeset del branch lo bumpa solo a patch (policy `updateInternalDependencies`
di changesets). Chi chiama `env.stringSafe("X").match(...)` si rompe con
result@2 senza alcun segnale nel changelog di `env`. Siamo già in territorio
breaking: tanto vale rompere per intero e bene.

### La direzione voluta

Una funzione `env` minuscola a cui si passa **la sorgente** e **la chiave**,
e che restituisce qualcosa su cui si chiamano i lettori — stringa, intero,
booleano, contenuto di un file, e via. La sorgente esplicita risolve da sola
il problema della testabilità e quello della cache.

### Prior art esaminata (2026-08-06)

Tre famiglie distinte.

**A — accessor concatenati per chiave.** [`env-var`](https://github.com/evanshortiss/env-var)
è la più vicina alla forma voluta:

```ts
import { from } from "env-var";
const env = from({ BASE_URL: import.meta.env.BASE_URL });
env.get("PORT").default("5432").asPortNumber();
env.get("DB_PASSWORD").required().asString();
```

La sorgente si lega **una volta** con `from(source)` invece di passarla a
ogni chiamata. `required()` e `default()` sono modificatori prima
dell'accessor, non metodi separati — è così che evitano l'esplosione
combinatoria che abbiamo noi. Lancia `EnvVarError`, non restituisce.
Estendibile con `extraAccessors`. **Non** sa leggere un file da un path.

**B — schema dichiarato in anticipo.** [`envalid`](https://github.com/af/envalid)
(`cleanEnv(process.env, { PORT: port(), ... })` → oggetto congelato e tipato,
con `default`/`devDefault`/`testDefault`/`choices`/`requiredWhen`, e un
`reporter` sostituibile) e [`@t3-oss/env-core`](https://env.t3.gg/docs/core),
che accetta **qualunque validatore Standard Schema**. L'argomento forte di
questa famiglia: lo schema è documentazione viva, un elenco autorevole di
tutte le variabili con tipo e obbligatorietà. L'argomento contrario: valida
tutto all'avvio, il che è giusto per un server e sbagliato per una libreria.

**C — valori di configurazione componibili.** Il `Config` di
[Effect](https://effect.website/docs/configuration/) è il più principiato, ed
è anche il parente stretto di better-result (che da Effect prende
`TaggedError`):

- primitive: `Config.string(k)`, `.number`, `.integer`, `.boolean`, `.date`,
  `.duration`, `.url`, `.literal`, `.redacted` (avvolge in `Redacted<string>`
  perché un segreto non finisca nei log)
- composizione: `Config.all`, `.nested(ns)`, `.array`, `.hashMap`
- trasformazione: `.map`, `.mapOrFail`, `.mapAttempt`
- opzionalità: `.withDefault(v)`, `.option`, `.orElse`, `.validate`
- **sorgente iniettata** via `ConfigProvider`: `fromEnv()`, `fromMap(map)`,
  `fromJson(obj)`, con `.nested`, `.constantCase`, `.orElse` per comporre i
  provider. La testabilità è per costruzione, non un ripiego.
- errori come unione discriminata con un `path`: `MissingData`, `InvalidData`

### L'osservazione che conta

**Il `Config` di Effect è, in sostanza, `Result` + `TaggedError` + un
provider — e le prime due ce le abbiamo già.** Il `ConfigProvider` è
esattamente la «sorgente» che vogliamo passare; `Config.all` è il nostro
`Result.all`; `mapOrFail` è il nostro `andThen`; gli errori tagged con un
`path` sono i nostri `TaggedError`. La parte principiata del design costa
poco perché la fondazione è già in casa.

E `@t3-oss/env-core` essendo basato su Standard Schema si innesta su ciò che
abbiamo appena costruito (`Result.fromSchema`, `result-codec`): un lettore di
chiave che sappia delegare a uno schema Standard Schema compone con tutto il
resto senza aggiungere dipendenze.

Da rubare, in ordine di valore:
1. la **sorgente iniettata** (Effect `ConfigProvider`, `env-var` `from`) —
   risolve testabilità e cache in un colpo;
2. i **modificatori prima dell'accessor** (`env-var`: `.required()`,
   `.default(v)`) invece di raddoppiare i metodi in `xSafe`;
3. `Redacted` di Effect per i segreti — piccolo, e previene una classe intera
   di incidenti nei log;
4. la delega a **Standard Schema** per i casi che i lettori nativi non coprono,
   al posto dell'attuale `something(key, fn)`;
5. `nested(ns)` per i prefissi (`DB_`), che oggi si scrivono a mano.

Da **non** rubare: la validazione totale all'avvio della famiglia B. Va bene
per un'applicazione, non per una libreria che non sa quali variabili
esistano.

### Domande aperte per quando lo si riprende

- Sorgente per chiamata (`env(source, key)`) o legata una volta
  (`env(source).get(key)`)? La prima è più funzionale, la seconda è meno
  verbosa a ogni sito di chiamata ed è la scelta di `env-var`.
- Si tiene una variante lanciante accanto a quella che restituisce `Result`?
  Con `.required()`/`.default()` come modificatori il bisogno cala molto.
- `EnvKeyName` deriva oggi dalle chiavi note di `NodeJS.ProcessEnv`: con una
  sorgente arbitraria quel vincolo va ripensato — probabilmente
  `keyof TSource`.
- La cache va tolta o legata alla sorgente? Se la sorgente è esplicita, una
  cache globale non ha più senso.
