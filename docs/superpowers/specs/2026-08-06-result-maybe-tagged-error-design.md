# Design — Tagged errors, combinatori e codec per `result` / `maybe`

Data: 2026-08-06
Stato: approvato in brainstorming, da implementare

## Contesto

`@efesto-cloud/result` e `@efesto-cloud/maybe` coprono bene la base monadica
(`map`, `flatMap`, `mapError`, `orElse`, `tap`, `unwrapOr`, …) ma hanno tre
lacune emerse confrontandosi con [better-result](https://github.com/dmmulroy/better-result):

1. **Nessun combinatore su collezioni.** `result` non espone né `all` né
   `partition` né `flatten`. `maybe` ha solo un `combine` binario a due
   argomenti.
2. **Gli errori non sono discriminabili dal compilatore.** La convenzione
   `DomainError` dei package `core` discrimina con `error.name`, che è
   dichiarato `string` su `Error`: nessun narrowing, nessuna esaustività.
3. **Il confine serializzato non ha contratto.** I `Result` attraversano
   loader/action di React Router e vengono ricostruiti nel client con
   `fromObject`, che si fida ciecamente del payload.

Questo design colma le tre lacune. `Result.gen` (composizione con generator) e
`Panic` sono deliberatamente **fuori scope** — vedi § Fuori scope.

## Vincolo trasversale: sono ammessi breaking change

I package coinvolti passano a una **major**. In particolare `match` cambia
firma senza overload di compatibilità: la forma posizionale è confermata
inutilizzata nei consumatori.

---

## 1. Nuovo package `@efesto-cloud/tagged-error`

Package indipendente, **zero dipendenze runtime** (l'unica dipendenza è
`@standard-schema/spec`, che è solo tipi e non emette codice), che segue la
forma standard del monorepo (ESM-only, `src/` → `dist/`, `exports` con `.` e
`./*`, `files: ["dist"]`, `publishConfig.access: public`).

Non dipende da `@efesto-cloud/result` e `result` non dipende da lui: un
`Result` deve poter trasportare qualunque errore, e chi vuole solo i
combinatori non deve tirarsi dietro i tagged error. I due si incontrano solo
in `@efesto-cloud/result-codec` (§ 5), che dipende da entrambi.

### 1.1 API

```ts
export type AnyTaggedError = Error & { readonly _tag: string };

export type TagHandlers<Self extends { readonly _tag: string }, R> = {
    [K in Self["_tag"]]: (error: Extract<Self, { readonly _tag: K }>) => R;
};

export function TaggedError<Tag extends string>(tag: Tag): TaggedErrorCtor<Tag>;

// forme data-last, per chi non vuole il metodo
export function matchError<Self extends AnyTaggedError, H extends TagHandlers<Self, unknown>>(
    error: Self,
    handlers: H & Record<Exclude<keyof H, Self["_tag"]>, never>,
): ReturnType<H[keyof H]>;

export function matchErrorPartial<Self extends AnyTaggedError, H extends PartialHandlers<Self>>(
    error: Self,
    handlers: H,
): ReturnType<NonNullable<H[keyof H]>>;

// costruisce uno StandardSchemaV1 che valida `_tag` e reidrata le istanze
export function taggedErrorSchema<C extends readonly TaggedErrorCtor<string>[]>(
    ...classes: C
): StandardSchemaV1<unknown, InstanceType<C[number]>>;
```

### 1.2 La firma di `match` — vincoli non negoziabili

La tipizzazione è stata verificata con uno spike compilato a
`tsc --strict` (8 test, incluso il caso dello snippet better-result). Tre
vincoli sono emersi sperimentalmente e **devono** essere rispettati:

```ts
abstract class TaggedErrorBase extends Error {
    abstract readonly _tag: string;

    match<
        Self extends { readonly _tag: string },
        H extends TagHandlers<Self, unknown>,
    >(
        this: Self,
        handlers: H & Record<Exclude<keyof H, Self["_tag"]>, never>,
    ): ReturnType<H[keyof H]> {
        const table = handlers as unknown as Record<
            string,
            (e: Self) => ReturnType<H[keyof H]>
        >;
        return table[this._tag](this);
    }
}
```

- **`match` va dichiarato una sola volta sulla base astratta, con `this: Self`.**
  È ciò che permette la chiamata su un *union* di errori: tutte le sottoclassi
  ereditano la stessa identica firma, TypeScript la deduplica e resta una sola
  signature generica. Dichiarare `match` sulle classi concrete non funziona
  (TypeScript rifiuta l'unione di più signature generiche).
- **Va inferito `H`, non `R`.** Con `handlers: TagHandlers<Self, R>` il tipo di
  ritorno collassa a `unknown` appena gli handler ritornano tipi eterogenei.
  Inferire l'oggetto intero e derivare `ReturnType<H[keyof H]>` risolve.
- **Serve `& Record<Exclude<keyof H, Self["_tag"]>, never>`.** Inferendo `H`
  dal literal, l'excess property check non scatta più: senza quell'intersezione
  un handler con un tag scritto male verrebbe accettato e mai eseguito.

### 1.3 Costruttore

```ts
type CtorArgs<Props extends object> = object extends Props
    ? [props?: Props & ErrorOptions & { message?: string }]
    : [props: Props & ErrorOptions & { message?: string }];
```

Il condizionale preserva la convenzione parameterless dei `core`: senza props
il costruttore si chiama a vuoto, con props diventano obbligatori.

L'implementazione deve:

- assegnare `this.name = tag` (own enumerable — è ciò che oggi fa sopravvivere
  il discriminatore a `JSON.stringify`);
- esporre `_tag` sia sull'istanza sia come statico sulla classe;
- fare `Object.assign(this, props)` **dopo** `super()`, escludendo `message` e
  `cause` che sono già gestiti da `Error`;
- esporre `toJSON()` che emette `{ ..._ownProps, _tag, name, message }` — serve
  perché `message` è own ma **non** enumerabile e altrimenti si perderebbe;
- esporre `static is(u: unknown): u is …` che verifica `u instanceof Error &&
  u._tag === tag` (funziona cross-realm, a differenza di `instanceof` sulla
  classe).

### 1.4 Costo noto

Il nome della classe si ripete nella stringa del tag:

```ts
class FooNotFoundError extends TaggedError("FooNotFoundError") {}
```

È inevitabile: il compilatore non può leggere il nome di una classe come tipo
letterale. Va mitigato con una regola di lint che verifica la coincidenza fra
tag e nome della classe (fuori scope per questa iterazione, da annotare come
follow-up).

---

## 2. `@efesto-cloud/result`

### 2.1 Breaking

- **`match` diventa la forma a oggetto:**
  ```ts
  match<A, B = A>(handlers: { ok: (data: T) => A; err: (e: E) => B }): A | B;
  ```
  La forma posizionale `match(onOk, onErr)` viene rimossa.
- **`fold` resta invariato e viene marcato `@deprecated`.** Non viene rimosso:
  a differenza di `match` è effettivamente usato nei consumatori, e ora è
  coperto da `match`. Il suo ordine argomenti invertito rispetto al vecchio
  `match` era il footgun che questa modifica elimina.
- **`zod` passa da `devDependency` a `peerDependency` opzionale.** Oggi
  `fromZod` espone `ZodError` nei tipi pubblici senza che `zod` sia dichiarata
  come dipendenza: chi installa `@efesto-cloud/result` senza `zod` ottiene un
  `.d.ts` che non risolve. `fromZod` resta, per chi vuole l'errore ricco di zod.

### 2.2 Additive — combinatori

```ts
// tuple-typed: preserva le posizioni
function all<T extends readonly Result<unknown, unknown>[]>(
    results: T,
): Result<OkTuple<T>, ErrUnion<T>>;

// non corto-circuita: processa tutto, preserva l'ordine relativo
function partition<T, E>(results: readonly Result<T, E>[]): [T[], E[]];

function flatten<T, E, F>(nested: Result<Result<T, E>, F>): Result<T, E | F>;
```

`all` restituisce il **primo** errore in ordine di iterazione. `partition` non
si ferma mai.

### 2.3 Additive — metodi e guard

```ts
tapBoth(handlers: { ok?: (data: T) => void; err?: (e: E) => void }): Result<T, E>;

// guard statici, utili in `.filter(Result.isOk)`
function isOk<T, E>(r: Result<T, E>): r is Success<T, E>;
function isErr<T, E>(r: Result<T, E>): r is Failure<T, E>;
```

**Il ponte verso l'async non va in `result`.** Un `andThenAsync` che ritorna
`ResultAsync` richiederebbe a `result` di importare `result-async`, che a sua
volta importa `result`: dipendenza circolare. Il ponte vive quindi in
`result-async` (§ 3) come `fromResult`.

### 2.4 Additive — Standard Schema

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";

function fromSchema<S extends StandardSchemaV1>(
    schema: S,
    input: unknown,
): Result<StandardSchemaV1.InferOutput<S>, readonly StandardSchemaV1.Issue[]>;
```

`@standard-schema/spec` è un package **solo di tipi**, zero runtime, zero
dipendenze. `fromSchema` funziona identico con zod, valibot e arktype. Se
`validate` restituisce una Promise, `fromSchema` lancia un `TypeError`: la
validazione asincrona non è supportata in questa firma (l'eventuale
`fromSchemaAsync` è follow-up).

Trade-off accettato: l'errore è `readonly Issue[]` (`{ message, path }`), non
`ZodError` — si perdono `.flatten()` / `.format()`. Per questo `fromZod` resta.

---

## 3. `@efesto-cloud/result-async`

- `match` alla forma a oggetto, coerente con `result` (breaking).
- `allAsync` — attende tutti gli input concorrentemente, poi raccoglie in
  ordine; primo errore in ordine di input.
- `partitionAsync` — stessa concorrenza, partiziona invece di corto-circuitare.
- `tapBoth` asincrono.
- **`fromResult(r: Result<T, E>): ResultAsync<T, E>`** — il ponte sync → async.
  Permette `fromResult(r).andThen(asyncFn)` senza uscire dalla catena, che oggi
  richiede di ricostruire a mano. Sta qui, non in `result`, per evitare la
  dipendenza circolare.

---

## 4. `@efesto-cloud/maybe` e `@efesto-cloud/maybe-async`

- **`match` alla forma a oggetto:** `match({ some, none })` (breaking).
- **`combine` binario → `all` variadico e tuple-typed** (breaking). Il
  `combine` a due argomenti attuale viene rimosso.
- **`toResult(errorFactory?: () => E): Result<T, E | NoneError>`** — oggi
  `toResult()` impone `NoneError`, che al confine col dominio è quasi sempre
  l'errore sbagliato. Il parametro è opzionale, il default resta `NoneError`.
- **Additive:** `flatten`, `or(other: Maybe<T>)`, `fromResult`.
- `fold` deprecato come in `result`.

---

## 5. Nuovo package `@efesto-cloud/result-codec`

Il codec **non** vive dentro `@efesto-cloud/result`: dipende sia da `result`
sia da `tagged-error` (per `taggedErrorSchema` e per i propri `EncodeError` /
`DecodeError`), e metterlo in `result` accoppierebbe la primitiva a entrambi.
Un package a sé mantiene `result` e `tagged-error` ortogonali e paganti solo
per chi il codec lo usa — coerente con la granularità del monorepo.

Dipendenze: `@efesto-cloud/result`, `@efesto-cloud/tagged-error`,
`@standard-schema/spec` (solo tipi).

```ts
const UserResult = codec({
    ok: UserSchema,                                        // qualunque StandardSchemaV1
    err: taggedErrorSchema(FooNotFoundError, InvalidFooNameError),
});

UserResult.serialize(result): Result<IResult<OkOut, ErrOut>, EncodeError>;
UserResult.serializeUnsafe(result): IResult<OkOut, ErrOut>;          // lancia EncodeError

UserResult.deserialize(input: unknown): Result<Result<Ok, Err>, DecodeError>;
UserResult.deserializeUnsafe(input: unknown): Result<Ok, Err>;       // lancia DecodeError
```

**Il doppio `Result` in `deserialize` è il punto del design:** distingue *"il
dominio ha detto no"* (il `Result` interno) da *"il payload sul filo non è
quello che ci aspettavamo"* (quello esterno) — schema cambiato, versioni
disallineate, dato corrotto in coda. `fromObject` oggi confonde i due casi e
produce un `Success` contenente spazzatura.

**Linea guida d'uso:** `serializeUnsafe` sul server (i dati li produci tu, un
fallimento è un bug) e `deserialize` sul client (il filo non è fidato).

`EncodeError` e `DecodeError` sono essi stessi `TaggedError` — il codec
dogfooda il package. `DecodeError` porta gli `Issue` di Standard Schema come
props, così il chiamante sa *cosa* non tornava nel payload.

### 5.1 `taggedErrorSchema` — reidratazione delle istanze

Esportato da `tagged-error`. Restituisce uno `StandardSchemaV1` il cui
`validate`:

1. verifica che l'input sia un oggetto con `_tag` fra quelli registrati;
2. ricostruisce l'istanza con `new Cls(props)`, **rimuovendo prima `_tag` e
   `name`** dai props (altrimenti `Object.assign` sovrascriverebbe i valori
   canonici della classe);
3. emette un `Issue` se il tag è sconosciuto.

Effetto: nel client `result.error instanceof FooNotFoundError` funziona, e il
codice di gestione errori è identico a quello del server.

---

## 6. `@efesto-cloud/toast`

`Toast<T, E>` è un `Result` con un `message` umano ed è il tipo che attraversa
il confine loader → client. Riceve gli stessi cambiamenti di `match` / `fold`
per non far divergere la famiglia. Nessun combinatore, nessun codec.

---

## 7. Migrazione nei package `core` dei progetti

**`DomainError` come classe base astratta sparisce.** Gli errori estendono
direttamente `TaggedError`:

```ts
// prima
export default class FooNotFoundError extends DomainError {}
// dopo
export default class FooNotFoundError extends TaggedError("FooNotFoundError") {}
```

**Il widening a `DomainError` nelle firme va sostituito da unioni precise.** È
il costo reale del cambiamento: allargando a un tipo con `_tag: string`
l'esaustività sparisce, ed è proprio l'esaustività che stiamo comprando.

```ts
// core/src/useCase/foos/ICreateFooUseCase.ts
export type CreateFooError = InvalidFooNameError | FooAlreadyExistsError;
```

**Escape hatch:** ai confini che davvero non vogliono sapere (middleware
d'errore, logging, mapper HTTP generici) si usa `AnyTaggedError` con
`matchErrorPartial` + `otherwise`.

**Migrazione graduale:** `DomainError` può sopravvivere come *type alias*
(`type DomainError = AnyTaggedError`) invece che come classe. Le firme
esistenti continuano a compilare e si stringono a unioni precise un use case
alla volta.

`error.name` continua a funzionare identico, quindi gli `switch (error.name)`
esistenti non si rompono durante la transizione.

La skill `Core:core` (`references/errors.md`) e le skill `Core:monad-result` /
`Core:monad-maybe` vanno aggiornate di conseguenza. Vivono in un repo
separato: è un follow-up tracciato, non parte di questa implementazione.

---

## 8. Testing

Ogni package ha già `src/index.test.ts` (runtime, `node:test` via `tsx`) e
`src/index.test-d.ts` (type-level). Si estendono entrambi.

I test **type-level sono obbligatori** per `tagged-error`: la firma di `match`
dipende da tre comportamenti non ovvi dell'inferenza, e una regressione
silenziosa (return type che collassa a `unknown`, esaustività che smette di
scattare) non verrebbe colta da un test runtime. Devono coprire, con
`@ts-expect-error` sui casi negativi:

- narrowing dentro gli handler su un union di ≥3 varianti;
- inferenza del ritorno con handler eterogenei;
- handler mancante → errore;
- tag inesistente → errore;
- `matchErrorPartial` senza `otherwise` → errore;
- `match` su un singolo errore concreto (non union).

Runtime: `_tag` / `name` / `instanceof` / `.is()` / `toJSON()` / round-trip
`JSON.parse(JSON.stringify(...))` / `cause` preservata / stack trace.

Lo spike già scritto e verificato copre tutti questi casi e va portato dentro
i test dei package, non riscritto da zero.

---

## 9. Fasi di implementazione

Lo scope tocca sette package. Si implementa in tre fasi con dipendenza
d'ordine, ciascuna verificabile e rilasciabile da sola:

**Fase A — `@efesto-cloud/tagged-error`.** Package nuovo, non rompe niente,
non dipende da nulla di esistente. È la fase con il rischio tecnico più alto
(la firma di `match`) ed è già coperta dallo spike verificato.

**Fase B — combinatori e `match` nella famiglia esistente.** `result`,
`result-async`, `maybe`, `maybe-async`, `toast`. Sono i breaking change; vanno
insieme perché `match` deve cambiare in modo coerente in tutta la famiglia.
Indipendente dalla fase A.

**Fase C — `@efesto-cloud/result-codec`.** Dipende da A e B.

## 10. Versioning

- `@efesto-cloud/tagged-error` — nuovo, `1.0.0` (allineato al resto della
  famiglia, che è già in `1.x`).
- `@efesto-cloud/result-codec` — nuovo, `1.0.0`.
- Changeset **major** per `result`, `result-async`, `maybe`, `maybe-async`,
  `toast`.

`scripts/check-packages.mjs` deve passare sui due package nuovi.

Dopo ogni modifica, nell'ordine: `pnpm typecheck`, `pnpm exec biome check
--write .`, `pnpm knip`. `knip.json` va aggiornato se i package nuovi
espongono entrypoint non standard.

---

## Fuori scope (deliberatamente)

- **`Result.gen` / composizione con generator.** È il salto qualitativo vero,
  ma è un design a sé (richiede `[Symbol.iterator]` sulle classi, tipizzazione
  non banale dell'unione degli errori, variante async con `Result.await`). Va
  valutato dopo aver visto come vengono usati i combinatori.
- **`Panic` e la callback protection.** Cambia la semantica di ogni
  combinatore, aggiunge un `try/catch` per chiamata, e non risolve un problema
  che i progetti hanno oggi.
- **`.unwrap(message)`** — vietato esplicitamente dalla skill `monad-result`.
- **`.tryRecover`** — è `orElse`, che esiste già.
- **Regola di lint tag ↔ nome classe** — follow-up.

## Assunzioni dichiarate

- La forma posizionale di `match` è inutilizzata nei consumatori (confermato
  dall'utente). `fold` invece è usato, quindi viene deprecato ma non rimosso.
- Il comportamento di turbo-stream di React Router sugli `Error` restituiti dai
  loader **non è stato verificato**. Il design non ci si appoggia: il codec
  serializza esplicitamente e non dipende da come il transport tratta gli
  `Error`.

---

## Appendice — spike verificato

Compilato a `tsc --strict --target es2022 --lib es2022,dom` con **zero errori**,
inclusi i due `@ts-expect-error` sui casi negativi. Da portare nei test dei
package, non da riscrivere.

```ts
// Spike: verifica che `error.match({...})` su un UNION di tagged error
// compili, restringa i tipi e imponga l'esaustività.

// ---------------------------------------------------------------------------
// Infrastruttura
// ---------------------------------------------------------------------------

export type TagHandlers<Self extends { readonly _tag: string }, R> = {
    [K in Self["_tag"]]: (error: Extract<Self, { readonly _tag: K }>) => R;
};

abstract class TaggedErrorBase extends Error {
    abstract readonly _tag: string;

    match<
        Self extends { readonly _tag: string },
        H extends TagHandlers<Self, unknown>,
    >(
        this: Self,
        handlers: H & Record<Exclude<keyof H, Self["_tag"]>, never>,
    ): ReturnType<H[keyof H]> {
        const table = handlers as unknown as Record<
            string,
            (e: Self) => ReturnType<H[keyof H]>
        >;
        return table[this._tag](this);
    }
}

type CtorArgs<Props extends object> = object extends Props
    ? [props?: Props & ErrorOptions & { message?: string }]
    : [props: Props & ErrorOptions & { message?: string }];

interface TaggedErrorCtor<Tag extends string> {
    new <Props extends object = object>(
        ...args: CtorArgs<Props>
    ): TaggedErrorBase &
        Readonly<Props> & { readonly _tag: Tag; readonly name: Tag };
    readonly _tag: Tag;
    is(u: unknown): u is TaggedErrorBase & { readonly _tag: Tag };
}

export function TaggedError<Tag extends string>(tag: Tag): TaggedErrorCtor<Tag> {
    class Impl extends TaggedErrorBase {
        readonly _tag = tag;
        static readonly _tag = tag;

        constructor(props?: Record<string, unknown> & ErrorOptions) {
            super(props?.message as string | undefined, { cause: props?.cause });
            this.name = tag;
            if (props) Object.assign(this, props);
        }

        toJSON(): Record<string, unknown> {
            return {
                ...(this as unknown as Record<string, unknown>),
                _tag: tag,
                name: tag,
                message: this.message,
            };
        }

        static is(u: unknown): u is Impl {
            return u instanceof Error && (u as { _tag?: unknown })._tag === tag;
        }
    }
    return Impl as unknown as TaggedErrorCtor<Tag>;
}

// ---------------------------------------------------------------------------
// Errori di dominio — stile efesto: parameterless di default
// ---------------------------------------------------------------------------

class CartNotFound extends TaggedError("CartNotFound") {}
class EmptyCart extends TaggedError("EmptyCart") {}
class OutOfStock extends TaggedError("OutOfStock")<{ sku: string }> {}
class PaymentDeclined extends TaggedError("PaymentDeclined") {}

type CheckoutError =
    | CartNotFound
    | EmptyCart
    | OutOfStock
    | PaymentDeclined;

// costruzione: parameterless resta parameterless
const _a = new CartNotFound();
const _b = new OutOfStock({ sku: "ABC-1" });
const _c = new CartNotFound({ message: "custom", cause: _b });

// ---------------------------------------------------------------------------
// TEST 1 — match su union, con narrowing dentro gli handler
// ---------------------------------------------------------------------------

declare const error: CheckoutError;

const status: number = error.match({
    CartNotFound: () => 404,
    EmptyCart: () => 400,
    OutOfStock: (e) => {
        const sku: string = e.sku; // deve essere tipizzato come OutOfStock
        return sku.length > 0 ? 409 : 409;
    },
    PaymentDeclined: () => 402,
});

// ---------------------------------------------------------------------------
// TEST 2 — inferenza del tipo di ritorno (union dei ritorni degli handler)
// ---------------------------------------------------------------------------

const mixed = error.match({
    CartNotFound: () => "not-found" as const,
    EmptyCart: () => 0,
    OutOfStock: () => true,
    PaymentDeclined: () => null,
});
const _mixedCheck: string | number | boolean | null = mixed;

// ---------------------------------------------------------------------------
// TEST 3 — ESAUSTIVITÀ: manca PaymentDeclined => deve essere errore
// ---------------------------------------------------------------------------

// @ts-expect-error - handler mancante per PaymentDeclined
const _incomplete = error.match({
    CartNotFound: () => 404,
    EmptyCart: () => 400,
    OutOfStock: () => 409,
});

// ---------------------------------------------------------------------------
// TEST 4 — chiave inesistente => deve essere errore
// ---------------------------------------------------------------------------

const _extra = error.match({
    CartNotFound: () => 404,
    EmptyCart: () => 400,
    OutOfStock: () => 409,
    PaymentDeclined: () => 402,
    // @ts-expect-error - variante inesistente
    NopeNotAnError: () => 500,
});

// ---------------------------------------------------------------------------
// TEST 5 — guard statico .is()
// ---------------------------------------------------------------------------

declare const unknownValue: unknown;
if (OutOfStock.is(unknownValue)) {
    const t: "OutOfStock" = unknownValue._tag;
    void t;
}

// ---------------------------------------------------------------------------
// TEST 6 — match su un singolo errore concreto (non union)
// ---------------------------------------------------------------------------

declare const single: OutOfStock;
const _singleOut: string = single.match({
    OutOfStock: (e) => e.sku,
});

// ---------------------------------------------------------------------------
// TEST 7 — resta un vero Error
// ---------------------------------------------------------------------------

const _isError: Error = new CartNotFound();
const _instanceCheck: boolean = new OutOfStock({ sku: "x" }) instanceof Error;
const _subclassCheck: boolean = new OutOfStock({ sku: "x" }) instanceof OutOfStock;

void status;
void _a;
void _c;
void _mixedCheck;
void _incomplete;
void _extra;
void _singleOut;
void _isError;
void _instanceCheck;
void _subclassCheck;

// ---------------------------------------------------------------------------
// TEST 8 — composizione esatta dello snippet better-result:
// Result.match({ ok, err }) con error.match({...}) annidato
// ---------------------------------------------------------------------------

interface Receipt { id: string }

declare class Ok<T, E> {
    readonly data: T;
    match<A, B = A>(h: { ok: (d: T) => A; err: (e: E) => B }): A | B;
}
declare class Err<T, E> {
    readonly error: E;
    match<A, B = A>(h: { ok: (d: T) => A; err: (e: E) => B }): A | B;
}
type Res<T, E> = Ok<T, E> | Err<T, E>;

declare function checkout(cartId: string): Res<Receipt, CheckoutError>;

const response: Response = checkout("cart_1").match({
    ok: (receipt) => Response.json(receipt, { status: 201 }),
    err: (error) =>
        error.match({
            CartNotFound: () =>
                Response.json({ message: "Cart not found" }, { status: 404 }),
            EmptyCart: () =>
                Response.json({ message: "Cart is empty" }, { status: 400 }),
            OutOfStock: (e) =>
                Response.json(
                    { message: `Out of stock: ${e.sku}` },
                    { status: 409 },
                ),
            PaymentDeclined: () =>
                Response.json({ message: "Payment declined" }, { status: 402 }),
        }),
});
void response;

// ---------------------------------------------------------------------------
// TEST 9 — match parziale con `otherwise`, e narrowing del residuo
// ---------------------------------------------------------------------------

type PartialHandlers<Self extends { readonly _tag: string }> = Partial<
    TagHandlers<Self, unknown>
> & { otherwise: (error: Self) => unknown };

declare function matchErrorPartial<
    Self extends { readonly _tag: string },
    H extends PartialHandlers<Self>,
>(error: Self, handlers: H): ReturnType<NonNullable<H[keyof H]>>;

const partial: number = matchErrorPartial(error, {
    CartNotFound: () => 404,
    OutOfStock: (e) => (e.sku.length > 0 ? 409 : 409),
    otherwise: () => 500,
});
void partial;

// senza `otherwise` deve fallire
// @ts-expect-error - manca otherwise
const _noOtherwise = matchErrorPartial(error, { CartNotFound: () => 404 });
void _noOtherwise;
```
