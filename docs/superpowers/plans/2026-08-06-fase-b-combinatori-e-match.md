# Fase B — Combinatori e `match` a oggetto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colmare le lacune della famiglia `result`/`maybe` — combinatori su collezioni che oggi mancano del tutto — e sostituire `match` posizionale con la forma a oggetto in tutta la famiglia.

**Architettura:** Modifiche in-place a cinque package esistenti. `match` cambia firma senza overload di compatibilità (breaking, la forma posizionale è confermata inutilizzata); `fold` resta e viene deprecato. I combinatori sono funzioni libere esposte sia come export di modulo sia nel namespace, seguendo il doppio-canale già in uso. `fromSchema` affianca `fromZod` disaccoppiando la validazione da zod.

**Tech Stack:** TypeScript 6 (`^6.0.2`), Node ≥ 24, ESM-only, pnpm workspace, Biome 2.4.11, `node:test` via `tsx`, Changesets.

**Indipendente dalla Fase A.** Può essere eseguita in parallelo o prima.

## Global Constraints

- Node `>=24`, pnpm `>=9`.
- Biome: **indentazione 4 spazi**, LF, virgolette doppie.
- Ogni package espone le factory **due volte** — come export di modulo (`export const ok = _ok`) e dentro il `namespace` omonimo — a partire da **una sola implementazione** `_nome`. Aggiungendo una factory, aggiungerla a entrambi i canali.
- La forma a oggetto di `match` è: `match({ ok, err })` per `Result`/`Toast`, `match({ some, none })` per `Maybe`.
- `fold` **non va rimosso**: va marcato `@deprecated` con un rimando a `match`.
- Dopo ogni modifica, nell'ordine: `pnpm typecheck`, `pnpm exec biome check --write .`, `pnpm knip`.
- **Le firme dei combinatori in questo piano sono state compilate e verificate** contro le classi reali. Copiale verbatim.

---

## File Structure

| File | Responsabilità |
|------|----------------|
| `packages/result/src/index.ts` | `match`, combinatori, `tapBoth`, guard, `fromSchema` |
| `packages/result/src/index.test.ts` / `.test-d.ts` | test |
| `packages/result/package.json` | `zod` → peerDependency opzionale, `@standard-schema/spec` |
| `packages/result-async/src/index.ts` | `match`, `tapBoth`, `fromResult`, `allAsync`, `partitionAsync` |
| `packages/maybe/src/index.ts` | `match`, `all` variadico, `toResult(errFn)`, `flatten`, `or`, `fromResult` |
| `packages/maybe-async/src/index.ts` | `match` |
| `packages/toast/src/index.ts` | `match` |
| `packages/toast/package.json` | dipendenze mancanti |

---

### Task 1: `match` a oggetto in `@efesto-cloud/result`

**Files:**
- Modify: `packages/result/src/index.ts` (`Success.match` ~riga 62, `Failure.match` ~riga 126, i due `fold` ~righe 80 e 144)
- Modify: `packages/result/src/index.test.ts`
- Modify: `packages/result/src/index.test-d.ts`

**Interfaces:**
- Consumes: niente
- Produces: `match<A, B = A>(handlers: { ok: (data: T) => A; err: (e: E) => B }): A | B` su `Success` e `Failure`

- [ ] **Step 1: Ricostruire i `dist` prima di iniziare**

I `dist/` locali sono disallineati rispetto ai sorgenti: `packages/maybe`
risolve `@efesto-cloud/result` verso `dist/index.d.ts`, che in questo momento
non espone il default export. Senza questo passo i typecheck dei package
dipendenti falliscono per un motivo che non c'entra col tuo lavoro.

```bash
pnpm install
pnpm build
pnpm typecheck
```

Atteso: tutti verdi.

- [ ] **Step 2: Scrivere il test che fallisce**

In `packages/result/src/index.test.ts`:

```ts
test("match instrada sul ramo ok", () => {
    const r = ok<number, string>(2);
    assert.equal(
        r.match({ ok: (d) => `ok:${d}`, err: (e) => `err:${e}` }),
        "ok:2",
    );
});

test("match instrada sul ramo err", () => {
    const r = err<string, number>("boom");
    assert.equal(
        r.match({ ok: (d) => `ok:${d}`, err: (e) => `err:${e}` }),
        "err:boom",
    );
});
```

- [ ] **Step 3: Eseguirlo per verificare che fallisca**

```bash
pnpm --filter @efesto-cloud/result test
```

Atteso: FAIL — `match` riceve ancora due argomenti posizionali, quindi
l'oggetto finisce in `onOk` e il risultato è sbagliato o il tipo non compila.

- [ ] **Step 4: Sostituire `match` in `Success`**

```ts
    match<A, B = A>(handlers: { ok: (data: T) => A; err: (e: E) => B }): A | B {
        return handlers.ok(this.data);
    }
```

- [ ] **Step 5: Sostituire `match` in `Failure`**

```ts
    match<A, B = A>(handlers: { ok: (data: T) => A; err: (e: E) => B }): A | B {
        return handlers.err(this.error);
    }
```

- [ ] **Step 6: Deprecare `fold` in entrambe le classi**

Aggiungere il tag sopra ciascuno dei due `fold` esistenti, **senza toccarne il
corpo né l'ordine degli argomenti**:

```ts
    /** @deprecated Usa `match({ ok, err })`. `fold` ha gli argomenti in ordine inverso. */
```

- [ ] **Step 7: Aggiungere il test type-level**

In `packages/result/src/index.test-d.ts`:

```ts
declare const r: Result<number, string>;

const _a: string = r.match({ ok: (d) => `n:${d}`, err: (e) => e });
const _b: string | number = r.match({ ok: (d) => d, err: (e) => e });

// @ts-expect-error - handler `err` mancante
const _c = r.match({ ok: (d) => d });

void _a;
void _b;
void _c;
```

- [ ] **Step 8: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/result test
pnpm --filter @efesto-cloud/result typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 9: Commit**

```bash
git add packages/result/src
git commit -m "feat(result)!: match passa alla forma a oggetto

BREAKING CHANGE: match(onOk, onErr) diventa match({ ok, err }).
fold resta ma e' deprecato: aveva gli argomenti in ordine inverso
rispetto al vecchio match, ed era il footgun che questo cambio
elimina."
```

---

### Task 2: Combinatori `all`, `partition`, `flatten` in `@efesto-cloud/result`

Oggi il package non espone **nessun** combinatore. Le firme qui sotto sono
state verificate contro le classi reali: `all` preserva la tupla e unisce gli
errori, e degrada correttamente ad array omogeneo.

**Files:**
- Modify: `packages/result/src/index.ts`
- Modify: `packages/result/src/index.test.ts`
- Modify: `packages/result/src/index.test-d.ts`

**Interfaces:**
- Consumes: `Success`, `Failure`, `_ok`, `_err`
- Produces:
  - `OkOf<R>` / `ErrOf<R>` — estraggono i parametri da un `Result`
  - `all<T extends readonly Result<unknown, unknown>[]>(results: readonly [...T]): Result<OkTuple<T>, ErrUnion<T>>`
  - `partition<T, E>(results: readonly Result<T, E>[]): [T[], E[]]`
  - `flatten<T, E, F>(nested: Result<Result<T, E>, F>): Result<T, E | F>`
  - esportati sia a modulo sia nel `namespace Result`

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
test("all raccoglie tutti i successi in tupla", () => {
    const r = all([ok(1), ok("due"), ok(true)] as const);
    assert.ok(r.isSuccess());
    assert.deepEqual(r.data, [1, "due", true]);
});

test("all ritorna il primo errore in ordine di iterazione", () => {
    const r = all([ok(1), err("primo"), err("secondo")]);
    assert.ok(r.isFailure());
    assert.equal(r.error, "primo");
});

test("all su lista vuota e un successo con tupla vuota", () => {
    const r = all([]);
    assert.ok(r.isSuccess());
    assert.deepEqual(r.data, []);
});

test("partition non corto-circuita e preserva l'ordine", () => {
    const [oks, errs] = partition([
        ok<number, string>(1),
        err<string, number>("a"),
        ok<number, string>(2),
        err<string, number>("b"),
    ]);
    assert.deepEqual(oks, [1, 2]);
    assert.deepEqual(errs, ["a", "b"]);
});

test("flatten appiattisce un Result annidato", () => {
    assert.equal(flatten(ok(ok(5))).unwrapOr(0), 5);
    assert.equal(flatten(ok(err<string, number>("dentro"))).unwrapOr(0), 0);
    assert.equal(flatten(err<string, Result<number, string>>("fuori")).unwrapOr(0), 0);
});
```

Aggiungere `all`, `partition`, `flatten` alla lista di import del file di test.

- [ ] **Step 2: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/result test
```

Atteso: FAIL — le tre funzioni non sono esportate.

- [ ] **Step 3: Implementare i tipi helper**

Subito dopo la dichiarazione `type Result<T, E> = Success<T, E> | Failure<T, E>;`:

```ts
export type OkOf<R> = R extends Success<infer T, infer _E>
    ? T
    : R extends Failure<infer T, infer _E>
      ? T
      : never;

export type ErrOf<R> = R extends Success<infer _T, infer E>
    ? E
    : R extends Failure<infer _T, infer E>
      ? E
      : never;

type OkTuple<T extends readonly unknown[]> = { [K in keyof T]: OkOf<T[K]> };
type ErrUnion<T extends readonly unknown[]> = {
    [K in keyof T]: ErrOf<T[K]>;
}[number];
```

`OkOf`/`ErrOf` sono condizionali distributivi su `R`: siccome `Result` è
l'union `Success | Failure`, entrambi i rami vanno scritti esplicitamente,
altrimenti l'inferenza fallisce sul membro non corrispondente.

- [ ] **Step 4: Implementare i combinatori**

Insieme alle altre implementazioni `_nome`:

```ts
const _all = <T extends readonly Result<unknown, unknown>[]>(
    results: readonly [...T],
): Result<OkTuple<T>, ErrUnion<T>> => {
    const values: unknown[] = [];
    for (const r of results) {
        if (r.isFailure()) return _err(r.error as ErrUnion<T>);
        values.push(r.data);
    }
    return _ok(values as OkTuple<T>);
};

const _partition = <T, E>(results: readonly Result<T, E>[]): [T[], E[]] => {
    const oks: T[] = [];
    const errs: E[] = [];
    for (const r of results) {
        if (r.isSuccess()) oks.push(r.data);
        else errs.push(r.error);
    }
    return [oks, errs];
};

const _flatten = <T, E, F>(
    nested: Result<Result<T, E>, F>,
): Result<T, E | F> =>
    nested.isFailure() ? _err<E | F, T>(nested.error) : nested.data;
```

- [ ] **Step 5: Esporre su entrambi i canali**

Aggiungere agli export di modulo:

```ts
export const all = _all;
export const partition = _partition;
export const flatten = _flatten;
```

E dentro `namespace Result`:

```ts
    export const all = _all;
    export const partition = _partition;
    export const flatten = _flatten;
```

- [ ] **Step 6: Aggiungere i test type-level**

In `packages/result/src/index.test-d.ts`:

```ts
declare const n: Result<number, "boom">;
declare const s: Result<string, "bang">;
declare const bl: Result<boolean, never>;

const _tuple = all([n, s, bl]);
if (_tuple.isSuccess()) {
    const _t: [number, string, boolean] = _tuple.data;
    void _t;
} else {
    const _e: "boom" | "bang" = _tuple.error;
    void _e;
}

declare const list: Result<number, "boom">[];
const _arr = all(list);
if (_arr.isSuccess()) {
    const _a2: number[] = _arr.data;
    void _a2;
}

const [_oks, _errs]: [number[], "boom"[]] = partition(list);

declare const nested: Result<Result<number, "dentro">, "fuori">;
const _flat: Result<number, "dentro" | "fuori"> = flatten(nested);

void _tuple;
void _arr;
void _oks;
void _errs;
void _flat;
```

- [ ] **Step 7: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/result test
pnpm --filter @efesto-cloud/result typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 8: Commit**

```bash
git add packages/result/src
git commit -m "feat(result): aggiunge all, partition e flatten"
```

---

### Task 3: `tapBoth` e i guard statici in `@efesto-cloud/result`

**Files:**
- Modify: `packages/result/src/index.ts`
- Modify: `packages/result/src/index.test.ts`

**Interfaces:**
- Consumes: `Success`, `Failure`
- Produces:
  - `tapBoth(handlers: { ok?: (data: T) => void; err?: (e: E) => void }): Result<T, E>` sulle due classi
  - `isOk<T, E>(r: Result<T, E>): r is Success<T, E>` e `isErr<T, E>(r: Result<T, E>): r is Failure<T, E>`, su entrambi i canali

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
test("tapBoth osserva il ramo giusto e restituisce il Result", () => {
    const visti: string[] = [];
    const r = ok<number, string>(1).tapBoth({
        ok: (d) => visti.push(`ok:${d}`),
        err: (e) => visti.push(`err:${e}`),
    });
    assert.deepEqual(visti, ["ok:1"]);
    assert.ok(r.isSuccess());

    const r2 = err<string, number>("x").tapBoth({
        err: (e) => visti.push(`err:${e}`),
    });
    assert.deepEqual(visti, ["ok:1", "err:x"]);
    assert.ok(r2.isFailure());
});

test("i guard statici filtrano una lista", () => {
    const list = [ok<number, string>(1), err<string, number>("a"), ok<number, string>(2)];
    assert.equal(list.filter(isOk).length, 2);
    assert.equal(list.filter(isErr).length, 1);
});
```

- [ ] **Step 2: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/result test
```

Atteso: FAIL — `tapBoth`, `isOk`, `isErr` non esistono.

- [ ] **Step 3: Implementare `tapBoth` in `Success`**

Accanto a `tap`/`tapError`:

```ts
    tapBoth(handlers: {
        ok?: (data: T) => void;
        err?: (e: E) => void;
    }): Result<T, E> {
        handlers.ok?.(this.data);
        return this;
    }
```

- [ ] **Step 4: Implementare `tapBoth` in `Failure`**

```ts
    tapBoth(handlers: {
        ok?: (data: T) => void;
        err?: (e: E) => void;
    }): Result<T, E> {
        handlers.err?.(this.error);
        return this;
    }
```

- [ ] **Step 5: Implementare i guard ed esporli su entrambi i canali**

```ts
const _isOk = <T, E>(r: Result<T, E>): r is Success<T, E> => r.isSuccess();
const _isErr = <T, E>(r: Result<T, E>): r is Failure<T, E> => r.isFailure();
```

```ts
export const isOk = _isOk;
export const isErr = _isErr;
```

E dentro `namespace Result`:

```ts
    export const isOk = _isOk;
    export const isErr = _isErr;
```

- [ ] **Step 6: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/result test
pnpm --filter @efesto-cloud/result typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 7: Commit**

```bash
git add packages/result/src
git commit -m "feat(result): aggiunge tapBoth e i guard statici isOk/isErr"
```

---

### Task 4: `fromSchema` e la dipendenza `zod` dichiarata

Oggi `packages/result/package.json` tiene `zod` in `devDependencies`, ma
`fromZod` espone `ZodError` nella firma pubblica: chi installa il package
senza zod ottiene un `.d.ts` che non risolve.

**Files:**
- Modify: `packages/result/package.json`
- Modify: `packages/result/src/index.ts`
- Modify: `packages/result/src/index.test.ts`

**Interfaces:**
- Consumes: `_ok`, `_err`
- Produces: `fromSchema<S extends StandardSchemaV1>(schema: S, input: unknown): Result<StandardSchemaV1.InferOutput<S>, readonly StandardSchemaV1.Issue[]>`, su entrambi i canali

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
import { z } from "zod";

test("fromSchema restituisce ok sull'input valido", () => {
    const schema = z.object({ nome: z.string() });
    const r = fromSchema(schema, { nome: "ada" });
    assert.ok(r.isSuccess());
    assert.deepEqual(r.data, { nome: "ada" });
});

test("fromSchema restituisce gli issue sull'input invalido", () => {
    const schema = z.object({ nome: z.string() });
    const r = fromSchema(schema, { nome: 42 });
    assert.ok(r.isFailure());
    assert.ok(Array.isArray(r.error));
    assert.ok(r.error.length > 0);
    assert.equal(typeof r.error[0].message, "string");
});

test("fromSchema lancia se la validazione e asincrona", () => {
    const asyncSchema = {
        "~standard": {
            version: 1 as const,
            vendor: "test",
            validate: () => Promise.resolve({ value: 1 }),
        },
    };
    assert.throws(() => fromSchema(asyncSchema, 1), TypeError);
});
```

- [ ] **Step 2: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/result test
```

Atteso: FAIL — `fromSchema` non è esportato.

- [ ] **Step 3: Correggere il manifest**

In `packages/result/package.json`, sostituire il blocco `devDependencies`:

```json
    "dependencies": {
        "@standard-schema/spec": "^1.0.0"
    },
    "peerDependencies": {
        "zod": "^4"
    },
    "peerDependenciesMeta": {
        "zod": {
            "optional": true
        }
    },
    "devDependencies": {
        "@types/node": "24",
        "zod": "^4"
    },
```

`zod` resta anche in `devDependencies` perché serve ai test. Come
`peerDependency` opzionale smette di essere un tipo pubblico non dichiarato,
senza obbligare chi non usa `fromZod` a installarla.

- [ ] **Step 4: Implementare**

In cima al file, accanto all'import di zod:

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
```

Insieme alle altre implementazioni:

```ts
const _fromSchema = <S extends StandardSchemaV1>(
    schema: S,
    input: unknown,
): Result<
    StandardSchemaV1.InferOutput<S>,
    readonly StandardSchemaV1.Issue[]
> => {
    const out = schema["~standard"].validate(input);
    if (out instanceof Promise) {
        throw new TypeError(
            "fromSchema richiede una validazione sincrona; usa uno schema non asincrono",
        );
    }
    return out.issues
        ? _err<readonly StandardSchemaV1.Issue[], StandardSchemaV1.InferOutput<S>>([...out.issues])
        : _ok(out.value);
};
```

Esporlo su entrambi i canali:

```ts
export const fromSchema = _fromSchema;
```

```ts
    export const fromSchema = _fromSchema;
```

- [ ] **Step 5: Installare ed eseguire i test**

```bash
pnpm install
pnpm --filter @efesto-cloud/result test
pnpm --filter @efesto-cloud/result typecheck:test
pnpm check-packages
```

Atteso: tutti verdi.

- [ ] **Step 6: Commit**

```bash
git add packages/result pnpm-lock.yaml
git commit -m "feat(result): fromSchema su Standard Schema, zod diventa peer opzionale

fromZod resta per chi vuole ZodError con flatten/format. zod passa a
peerDependency opzionale: era una devDependency ma compariva nei tipi
pubblici, quindi il .d.ts non risolveva senza zod installata."
```

---

### Task 5: `match`, `tapBoth` e `fromResult` in `@efesto-cloud/result-async`

**Files:**
- Modify: `packages/result-async/src/index.ts` (`match` ~riga 84)
- Modify: `packages/result-async/src/index.test.ts`

**Interfaces:**
- Consumes: `Result`, `ok`, `err` da `@efesto-cloud/result`
- Produces:
  - `ResultAsync.prototype.match<A, B = A>(handlers: { ok: (data: T) => A | Promise<A>; err: (e: E) => B | Promise<B> }): Promise<A | B>`
  - `ResultAsync.prototype.tapBoth(handlers: { ok?: (data: T) => void | Promise<void>; err?: (e: E) => void | Promise<void> }): ResultAsync<T, E>`
  - `fromResult<T, E>(r: Result<T, E>): ResultAsync<T, E>` — statica e come export di modulo

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
test("match a oggetto instrada su entrambi i rami", async () => {
    assert.equal(
        await okAsync<number, string>(1).match({
            ok: (d) => `ok:${d}`,
            err: (e) => `err:${e}`,
        }),
        "ok:1",
    );
    assert.equal(
        await errAsync<string, number>("boom").match({
            ok: (d) => `ok:${d}`,
            err: (e) => `err:${e}`,
        }),
        "err:boom",
    );
});

test("tapBoth osserva senza alterare il Result", async () => {
    const visti: string[] = [];
    const r = await okAsync<number, string>(1).tapBoth({
        ok: (d) => { visti.push(`ok:${d}`); },
        err: (e) => { visti.push(`err:${e}`); },
    });
    assert.deepEqual(visti, ["ok:1"]);
    assert.ok(r.isSuccess());
});

test("fromResult fa da ponte sync -> async", async () => {
    const r = await fromResult(ok<number, string>(2)).andThen(
        async (n) => ok<number, string>(n * 2),
    );
    assert.ok(r.isSuccess());
    assert.equal(r.data, 4);
});
```

- [ ] **Step 2: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/result-async test
```

Atteso: FAIL.

- [ ] **Step 3: Sostituire `match`**

```ts
    match<A, B = A>(handlers: {
        ok: (data: T) => A | Promise<A>;
        err: (e: E) => B | Promise<B>;
    }): Promise<A | B> {
        return this._promise.then((r) =>
            r.isSuccess() ? handlers.ok(r.data) : handlers.err(r.error),
        );
    }
```

- [ ] **Step 4: Aggiungere `tapBoth`**

Accanto a `tap`/`tapError`:

```ts
    tapBoth(handlers: {
        ok?: (data: T) => void | Promise<void>;
        err?: (e: E) => void | Promise<void>;
    }): ResultAsync<T, E> {
        return new ResultAsync(
            this._promise.then(async (r) => {
                if (r.isSuccess()) await handlers.ok?.(r.data);
                else await handlers.err?.(r.error);
                return r;
            }),
        );
    }
```

- [ ] **Step 5: Aggiungere `fromResult`**

Fra le static factory della classe:

```ts
    static fromResult<T, E>(result: Result<T, E>): ResultAsync<T, E> {
        return new ResultAsync<T, E>(Promise.resolve(result));
    }
```

E fra gli export di modulo, accanto a `fromPromise`:

```ts
export const fromResult = ResultAsync.fromResult;
```

- [ ] **Step 6: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/result-async test
pnpm --filter @efesto-cloud/result-async typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 7: Commit**

```bash
git add packages/result-async/src
git commit -m "feat(result-async)!: match a oggetto, tapBoth e fromResult

BREAKING CHANGE: match(onOk, onErr) diventa match({ ok, err }).
fromResult e' il ponte sync -> async: sta qui e non in result perche'
result non puo' importare result-async senza creare un ciclo."
```

---

### Task 6: `allAsync` e `partitionAsync`

**Files:**
- Modify: `packages/result-async/src/index.ts`
- Modify: `packages/result-async/src/index.test.ts`

**Interfaces:**
- Consumes: `all`, `partition`, `OkOf`, `ErrOf` da `@efesto-cloud/result` (Task 2)
- Produces:
  - `allAsync(inputs)` — attende concorrentemente, poi si comporta come `all`
  - `partitionAsync(inputs)` — attende concorrentemente, poi partiziona

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
test("allAsync attende tutto e raccoglie", async () => {
    const r = await allAsync([okAsync(1), okAsync("due")]);
    assert.ok(r.isSuccess());
    assert.deepEqual(r.data, [1, "due"]);
});

test("allAsync ritorna il primo errore in ordine di input", async () => {
    const r = await allAsync([
        okAsync<number, string>(1),
        errAsync<string, number>("primo"),
        errAsync<string, number>("secondo"),
    ]);
    assert.ok(r.isFailure());
    assert.equal(r.error, "primo");
});

test("partitionAsync non corto-circuita", async () => {
    const [oks, errs] = await partitionAsync([
        okAsync<number, string>(1),
        errAsync<string, number>("a"),
        okAsync<number, string>(2),
    ]);
    assert.deepEqual(oks, [1, 2]);
    assert.deepEqual(errs, ["a"]);
});
```

- [ ] **Step 2: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/result-async test
```

Atteso: FAIL.

- [ ] **Step 3: Implementare**

```ts
export async function allAsync<
    T extends readonly PromiseLike<Result<unknown, unknown>>[],
>(
    inputs: readonly [...T],
): Promise<Result<{ [K in keyof T]: OkOf<Awaited<T[K]>> }, ErrOf<Awaited<T[number]>>>> {
    const settled = await Promise.all(inputs);
    return all(settled) as Result<
        { [K in keyof T]: OkOf<Awaited<T[K]>> },
        ErrOf<Awaited<T[number]>>
    >;
}

export async function partitionAsync<T, E>(
    inputs: readonly PromiseLike<Result<T, E>>[],
): Promise<[T[], E[]]> {
    return partition(await Promise.all(inputs));
}
```

Aggiungere `all`, `partition`, e i tipi `OkOf`/`ErrOf` alla riga di import da
`@efesto-cloud/result`.

`Promise.all` avvia tutto concorrentemente e mantiene l'ordine di input: è ciò
che rende "il primo errore" deterministico e indipendente dai tempi.

- [ ] **Step 4: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/result-async test
pnpm --filter @efesto-cloud/result-async typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 5: Commit**

```bash
git add packages/result-async/src
git commit -m "feat(result-async): aggiunge allAsync e partitionAsync"
```

---

### Task 7: `@efesto-cloud/maybe`

Il pezzo più denso della fase: `match` a oggetto, `combine` binario sostituito
da `all` variadico, `toResult` con errore configurabile, più `flatten`, `or`,
`fromResult`.

**Files:**
- Modify: `packages/maybe/src/index.ts`
- Modify: `packages/maybe/src/index.test.ts`
- Modify: `packages/maybe/src/index.test-d.ts`

**Interfaces:**
- Consumes: `Result`, `ok`, `err` da `@efesto-cloud/result`
- Produces:
  - `match<A, B = A>(handlers: { some: (v: T) => A; none: () => B }): A | B`
  - `toResult<E = NoneError>(errorFactory?: () => E): Result<T, E | NoneError>`
  - `or(other: Maybe<T>): Maybe<T>`
  - `all<T extends readonly Maybe<NonNullable<unknown>>[]>(maybes: readonly [...T]): Maybe<SomeTuple<T>>` — **sostituisce `combine`**
  - `flatten<T>(nested: Maybe<Maybe<T>>): Maybe<T>`
  - `fromResult<T>(r: Result<T, unknown>): Maybe<T>`

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
test("match a oggetto instrada su entrambi i rami", () => {
    assert.equal(some(3).match({ some: (v) => `v:${v}`, none: () => "vuoto" }), "v:3");
    assert.equal(none<number>().match({ some: (v) => `v:${v}`, none: () => "vuoto" }), "vuoto");
});

test("all raccoglie in tupla e propaga il None", () => {
    const r = all([some(1), some("due")] as const);
    assert.ok(r.isSome());
    assert.deepEqual(r.data, [1, "due"]);
    assert.ok(all([some(1), none<string>()] as const).isNone());
    assert.ok(all([]).isSome());
});

test("toResult accetta un errore custom", () => {
    class MioErrore extends Error {}
    const r = none<number>().toResult(() => new MioErrore());
    assert.ok(r.isFailure());
    assert.ok(r.error instanceof MioErrore);
    assert.ok(none<number>().toResult().error instanceof NoneError);
    assert.equal(some(5).toResult(() => new MioErrore()).unwrapOr(0), 5);
});

test("or ripiega su un altro Maybe", () => {
    assert.equal(some(1).or(some(2)).unwrapOr(0), 1);
    assert.equal(none<number>().or(some(2)).unwrapOr(0), 2);
    assert.ok(none<number>().or(none<number>()).isNone());
});

test("flatten appiattisce un Maybe annidato", () => {
    assert.equal(flatten(some(some(5))).unwrapOr(0), 5);
    assert.ok(flatten(some(none<number>())).isNone());
    assert.ok(flatten(none<Maybe<number>>()).isNone());
});

test("fromResult converte un Result", () => {
    assert.equal(fromResult(Result.ok(3)).unwrapOr(0), 3);
    assert.ok(fromResult(Result.err("x")).isNone());
});
```

- [ ] **Step 2: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/maybe test
```

Atteso: FAIL.

- [ ] **Step 3: Sostituire `match` nelle due classi**

In `Some`:

```ts
    match<A, B = A>(handlers: {
        some: (value: T) => A;
        none: () => B;
    }): A | B {
        return handlers.some(this.data);
    }
```

In `None`:

```ts
    match<A, B = A>(handlers: {
        some: (value: T) => A;
        none: () => B;
    }): A | B {
        return handlers.none();
    }
```

Deprecare `fold` in entrambe con:

```ts
    /** @deprecated Usa `match({ some, none })`. */
```

- [ ] **Step 4: Rendere configurabile `toResult`**

In `Some`:

```ts
    toResult<E = NoneError>(_?: () => E): Result<T, E | NoneError> {
        return Result.ok(this.data);
    }
```

In `None`:

```ts
    toResult<E = NoneError>(errorFactory?: () => E): Result<T, E | NoneError> {
        return Result.err(errorFactory ? errorFactory() : new NoneError());
    }
```

- [ ] **Step 5: Aggiungere `or` alle due classi**

In `Some`:

```ts
    or(_: Maybe<T>): Maybe<T> {
        return this;
    }
```

In `None`:

```ts
    or(other: Maybe<T>): Maybe<T> {
        return other;
    }
```

- [ ] **Step 6: Sostituire `combine` con `all`, e aggiungere `flatten` e `fromResult`**

Rimuovere l'implementazione `_combine`. Al suo posto:

```ts
type SomeOf<M> = M extends Some<infer T>
    ? T
    : M extends None<infer T>
      ? T
      : never;

type SomeTuple<T extends readonly unknown[]> = {
    [K in keyof T]: SomeOf<T[K]>;
} & NonNullable<unknown>;

const _all = <T extends readonly Maybe<NonNullable<unknown>>[]>(
    maybes: readonly [...T],
): Maybe<SomeTuple<T>> => {
    const values: unknown[] = [];
    for (const m of maybes) {
        if (m.isNone()) return new None<SomeTuple<T>>();
        values.push(m.data);
    }
    return new Some<SomeTuple<T>>(values as SomeTuple<T>);
};

const _flatten = <T extends NonNullable<unknown>>(
    nested: Maybe<Maybe<T>>,
): Maybe<T> => (nested.isNone() ? new None<T>() : nested.data);

const _fromResult = <T extends NonNullable<unknown>>(
    r: Result<T, unknown>,
): Maybe<T> => (r.isSuccess() ? new Some<T>(r.data) : new None<T>());
```

`& NonNullable<unknown>` su `SomeTuple` serve a soddisfare il vincolo di
`Maybe<T>`: una tupla lo soddisfa, ma senza l'intersezione TypeScript non lo
deduce dal tipo mappato.

- [ ] **Step 7: Aggiornare entrambi i canali di export**

Sostituire `combine` con `all` e aggiungere le due nuove, sia negli export di
modulo sia nel `namespace Maybe`:

```ts
export const all = _all;
export const flatten = _flatten;
export const fromResult = _fromResult;
```

```ts
    export const all = _all;
    export const flatten = _flatten;
    export const fromResult = _fromResult;
```

Rimuovere `export const combine = _combine;` e la riga corrispondente nel
namespace.

- [ ] **Step 8: Aggiungere i test type-level**

```ts
declare const a: Maybe<number>;
declare const b: Maybe<string>;

const _t = all([a, b]);
if (_t.isSome()) {
    const _tt: [number, string] = _t.data;
    void _tt;
}

class MioErrore extends Error {}
const _r: Result<number, MioErrore | NoneError> = a.toResult(() => new MioErrore());

const _m: string = a.match({ some: (v) => `n:${v}`, none: () => "vuoto" });

// @ts-expect-error - handler `none` mancante
const _bad = a.match({ some: (v) => v });

void _t;
void _r;
void _m;
void _bad;
```

- [ ] **Step 9: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/maybe test
pnpm --filter @efesto-cloud/maybe typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 10: Commit**

```bash
git add packages/maybe/src
git commit -m "feat(maybe)!: match a oggetto, all variadico e toResult configurabile

BREAKING CHANGE: match(onSome, onNone) diventa match({ some, none }).
combine(m1, m2) e' rimosso, sostituito da all([...]) variadico e
tuple-typed. toResult accetta ora una factory d'errore: prima imponeva
NoneError, che al confine col dominio e' quasi sempre sbagliato."
```

---

### Task 8: `match` in `@efesto-cloud/maybe-async`

**Files:**
- Modify: `packages/maybe-async/src/index.ts`
- Modify: `packages/maybe-async/src/index.test.ts`

**Interfaces:**
- Consumes: `Maybe`, `some`, `none`
- Produces: `match<A, B = A>(handlers: { some: (v: T) => A | Promise<A>; none: () => B | Promise<B> }): Promise<A | B>`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
test("match a oggetto instrada su entrambi i rami", async () => {
    assert.equal(
        await someAsync(1).match({ some: (v) => `v:${v}`, none: () => "vuoto" }),
        "v:1",
    );
    assert.equal(
        await noneAsync<number>().match({ some: (v) => `v:${v}`, none: () => "vuoto" }),
        "vuoto",
    );
});
```

Se i nomi delle factory del package differiscono da `someAsync`/`noneAsync`,
usare quelli effettivamente esportati da `packages/maybe-async/src/index.ts`.

- [ ] **Step 2: Eseguirlo per verificare che fallisca**

```bash
pnpm --filter @efesto-cloud/maybe-async test
```

Atteso: FAIL.

- [ ] **Step 3: Sostituire `match`**

```ts
    match<A, B = A>(handlers: {
        some: (value: T) => A | Promise<A>;
        none: () => B | Promise<B>;
    }): Promise<A | B> {
        return this._promise.then((m) =>
            m.isSome() ? handlers.some(m.data) : handlers.none(),
        );
    }
```

- [ ] **Step 4: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/maybe-async test
pnpm --filter @efesto-cloud/maybe-async typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 5: Commit**

```bash
git add packages/maybe-async/src
git commit -m "feat(maybe-async)!: match passa alla forma a oggetto

BREAKING CHANGE: match(onSome, onNone) diventa match({ some, none })."
```

---

### Task 9: `@efesto-cloud/toast` — `match` e dipendenze mancanti

`packages/toast/package.json` non dichiara **nessuna** dipendenza, ma
`src/index.ts` importa `@efesto-cloud/maybe` e `@efesto-cloud/result`.
Installato da solo, il package è rotto.

**Files:**
- Modify: `packages/toast/package.json`
- Modify: `packages/toast/src/index.ts` (`match` ~riga 68 e il gemello in `ToastFailure`)
- Modify: `packages/toast/src/index.test.ts`

**Interfaces:**
- Consumes: `Maybe`, `IResult`
- Produces: `match<A, B = A>(handlers: { ok: (data: T) => A; err: (e: E) => B }): A | B` su `ToastSuccess` e `ToastFailure`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
test("match a oggetto instrada su entrambi i rami", () => {
    assert.equal(
        Toast.ok("fatto", 1).match({ ok: (d) => `ok:${d}`, err: (e) => `err:${e}` }),
        "ok:1",
    );
    assert.equal(
        Toast.err("rotto", "boom").match({ ok: (d) => `ok:${d}`, err: (e) => `err:${e}` }),
        "err:boom",
    );
});
```

- [ ] **Step 2: Eseguirlo per verificare che fallisca**

```bash
pnpm --filter @efesto-cloud/toast test
```

Atteso: FAIL.

- [ ] **Step 3: Dichiarare le dipendenze**

In `packages/toast/package.json`, aggiungere prima di `keywords`:

```json
    "dependencies": {
        "@efesto-cloud/maybe": "workspace:*",
        "@efesto-cloud/result": "workspace:*"
    },
    "devDependencies": {
        "@types/node": "24"
    },
```

- [ ] **Step 4: Sostituire `match` in `ToastSuccess`**

```ts
    match<A, B = A>(handlers: { ok: (data: T) => A; err: (e: E) => B }): A | B {
        return handlers.ok(this.data);
    }
```

- [ ] **Step 5: Sostituire `match` in `ToastFailure`**

```ts
    match<A, B = A>(handlers: { ok: (data: T) => A; err: (e: E) => B }): A | B {
        return handlers.err(this.error);
    }
```

Deprecare i due `fold` con lo stesso commento usato nel Task 1.

- [ ] **Step 6: Installare ed eseguire i test**

```bash
pnpm install
pnpm --filter @efesto-cloud/toast test
pnpm --filter @efesto-cloud/toast typecheck:test
pnpm check-packages
```

Atteso: tutti verdi.

- [ ] **Step 7: Commit**

```bash
git add packages/toast pnpm-lock.yaml
git commit -m "feat(toast)!: match a oggetto e dipendenze dichiarate

BREAKING CHANGE: match(onOk, onErr) diventa match({ ok, err }).

Il package importava @efesto-cloud/maybe e @efesto-cloud/result senza
dichiararli: installato da solo era rotto."
```

---

### Task 10: Verifica finale e changeset

**Files:**
- Create: `.changeset/<nome-generato>.md`

- [ ] **Step 1: Eseguire la catena di verifica completa**

```bash
pnpm build
pnpm typecheck
pnpm exec biome check --write .
pnpm knip
pnpm check-packages
pnpm test
```

Atteso: tutti verdi. Se `knip` segnala come inutilizzati gli export nuovi
(`all`, `partition`, `flatten`, `isOk`, `isErr`, `fromSchema`, `tapBoth`,
`fromResult`, `or`), **non** rimuoverli: sono API pubblica. `knip.json` ha già
`ignoreExportsUsedInFile: true`; se serve, aggiungere gli entry per i package
interessati.

- [ ] **Step 2: Creare il changeset**

```bash
pnpm changeset
```

Selezionare `@efesto-cloud/result`, `@efesto-cloud/result-async`,
`@efesto-cloud/maybe`, `@efesto-cloud/maybe-async`, `@efesto-cloud/toast`,
tutti **major**, con questa descrizione:

```
BREAKING: `match` passa dalla forma posizionale a quella a oggetto —
`match({ ok, err })` per Result/Toast, `match({ some, none })` per Maybe.
`Maybe.combine(m1, m2)` e' rimosso, sostituito da `Maybe.all([...])`
variadico e tuple-typed. `fold` resta ma e' deprecato.

Aggiunti: `all`, `partition`, `flatten`, `tapBoth`, `isOk`/`isErr` e
`fromSchema` (Standard Schema) su Result; `allAsync`, `partitionAsync`
e `fromResult` su ResultAsync; `flatten`, `or`, `fromResult` e
`toResult(errorFactory)` su Maybe.

Correzioni di packaging: `zod` diventa una peerDependency opzionale di
result (era una devDependency ma compariva nei tipi pubblici); toast
dichiara le dipendenze su maybe e result, che prima mancavano del tutto.
```

- [ ] **Step 3: Commit**

```bash
git add .changeset knip.json
git commit -m "chore: changeset per la major di result/maybe/toast"
```

---

## Self-Review

**Copertura della spec:** § 2.1 (`match` breaking, `fold` deprecato, zod peer)
→ Task 1 e 4. § 2.2 (combinatori) → Task 2. § 2.3 (`tapBoth`, guard) → Task 3.
§ 2.4 (`fromSchema`) → Task 4. § 3 (result-async, incluso `fromResult`) →
Task 5 e 6. § 4 (maybe e maybe-async) → Task 7 e 8. § 6 (toast, incluso il bug
delle dipendenze) → Task 9. § 10 (versioning) → Task 10.

**Fuori dal piano, di proposito:** la potatura dei metodi di concatenazione di
`Toast`, che la spec classifica come follow-up.

**Coerenza dei tipi:** `OkOf`/`ErrOf` sono definiti nel Task 2 (esportati da
`result`) e riusati nel Task 6 da `result-async`. `SomeOf`/`SomeTuple`
esistono solo nel Task 7 e restano interni a `maybe`. La firma di `match` è
identica in Task 1, 5, 9 (`{ ok, err }`) e in Task 7, 8 (`{ some, none }`).
`fromResult` esiste in due package con semantiche diverse e dichiarate: in
`result-async` è il ponte sync → async, in `maybe` è la conversione da
`Result` a `Maybe`.

**Prerequisito emerso in fase di piano:** il Task 1 apre con `pnpm build`
perché i `dist/` locali sono disallineati e fanno fallire il typecheck dei
package dipendenti per un motivo estraneo al lavoro.
