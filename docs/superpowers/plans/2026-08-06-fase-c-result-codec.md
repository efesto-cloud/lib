# Fase C — `@efesto-cloud/result-codec` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare un contratto verificato al confine dove i `Result` vengono serializzati — loader/action di React Router verso il client — distinguendo *"il dominio ha detto no"* da *"il payload non è quello che ci aspettavamo"*.

**Architettura:** Un `codec({ ok, err })` costruito su due validatori Standard Schema. `serialize` valida il ramo attivo e produce l'oggetto piatto `IResult`; `deserialize` valida prima la busta, poi il ramo, e ricostruisce il `Result`. Il doppio `Result` in uscita da `deserialize` è il punto del design: quello esterno riporta i guasti di trasporto, quello interno l'esito di dominio.

**Tech Stack:** TypeScript 6 (`^6.0.2`), Node ≥ 24, ESM-only, pnpm workspace, Biome 2.4.11, `node:test` via `tsx`, Changesets.

**Dipende dalle Fasi A e B.** Non iniziare prima che entrambe siano su `main` (servono `taggedErrorSchema` e i tipi di `result`).

## Global Constraints

- Node `>=24`, pnpm `>=9`, ESM-only, forma di package standard del monorepo.
- `repository.directory` deve essere `packages/result-codec`.
- Biome: **indentazione 4 spazi**, LF, virgolette doppie.
- Dipendenze: `@efesto-cloud/result` (`workspace:*`), `@efesto-cloud/tagged-error` (`workspace:*`), `@standard-schema/spec` (`^1.0.0`).
- `serialize` **non** chiama `toJSON()` esplicitamente: restituisce la busta con l'istanza d'errore così com'è. La conversione avviene quando `JSON.stringify` (o `Response.json`) invoca `toJSON()`, che è il contratto standard di JavaScript ed è ciò che fanno sia React Router sia `Response.json`. Chiamarlo a mano renderebbe il valore a runtime diverso dal tipo dichiarato.
- Dopo ogni modifica, nell'ordine: `pnpm typecheck`, `pnpm exec biome check --write .`, `pnpm knip`.

---

## File Structure

| File | Responsabilità |
|------|----------------|
| `packages/result-codec/package.json` | Manifest |
| `packages/result-codec/tsconfig.json` | Build config |
| `packages/result-codec/tsconfig.test.json` | Typecheck dei test |
| `packages/result-codec/src/index.ts` | `EncodeError`, `DecodeError`, `codec()` |
| `packages/result-codec/src/index.test.ts` | Test runtime, incluso il round-trip end-to-end |
| `packages/result-codec/src/index.test-d.ts` | Test type-level |

---

### Task 1: Scaffolding del package

**Files:**
- Create: `packages/result-codec/package.json`
- Create: `packages/result-codec/tsconfig.json`
- Create: `packages/result-codec/tsconfig.test.json`
- Create: `packages/result-codec/src/index.ts`
- Create: `packages/result-codec/src/index.test.ts`

**Interfaces:**
- Consumes: `TaggedError` da `@efesto-cloud/tagged-error` (Fase A)
- Produces: package installabile con `EncodeError` e `DecodeError` esportati

- [ ] **Step 1: Scrivere il test che fallisce**

`packages/result-codec/src/index.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { DecodeError, EncodeError } from "./index.js";

test("gli errori del codec sono tagged error", () => {
    const e = new EncodeError({ issues: [], branch: "ok" });
    assert.equal(e._tag, "EncodeError");
    assert.ok(e instanceof Error);
    const d = new DecodeError({ issues: [], branch: "envelope" });
    assert.equal(d._tag, "DecodeError");
    assert.equal(d.branch, "envelope");
});
```

- [ ] **Step 2: Eseguirlo per verificare che fallisca**

```bash
pnpm --filter @efesto-cloud/result-codec test
```

Atteso: FAIL — il package non esiste.

- [ ] **Step 3: Creare il manifest**

`packages/result-codec/package.json`:

```json
{
    "name": "@efesto-cloud/result-codec",
    "version": "1.0.0",
    "description": "Result serialization codec for efesto-cloud",
    "repository": {
        "type": "git",
        "url": "git+https://github.com/efesto-cloud/lib.git",
        "directory": "packages/result-codec"
    },
    "type": "module",
    "module": "dist/index.js",
    "types": "dist/index.d.ts",
    "exports": {
        ".": {
            "import": "./dist/index.js",
            "types": "./dist/index.d.ts"
        },
        "./*": {
            "import": "./dist/*.js",
            "types": "./dist/*.d.ts"
        }
    },
    "files": [
        "dist"
    ],
    "scripts": {
        "build": "tsc --project tsconfig.json",
        "typecheck": "tsc --noEmit",
        "typecheck:test": "tsc --noEmit -p tsconfig.test.json",
        "test": "tsx --test \"src/**/*.test.ts\"",
        "clean": "rm -rf dist"
    },
    "dependencies": {
        "@efesto-cloud/result": "workspace:*",
        "@efesto-cloud/tagged-error": "workspace:*",
        "@standard-schema/spec": "^1.0.0"
    },
    "devDependencies": {
        "@types/node": "24",
        "zod": "^4"
    },
    "keywords": [],
    "license": "MIT",
    "publishConfig": {
        "access": "public"
    }
}
```

`zod` è solo per i test: serve uno schema Standard Schema concreto con cui
verificare il codec.

- [ ] **Step 4: Creare i tsconfig**

`packages/result-codec/tsconfig.json`:

```json
{
    "extends": "../../tsconfig.json",
    "compilerOptions": {
        "outDir": "dist",
        "rootDir": "src"
    },
    "include": ["src"],
    "exclude": [
        "node_modules",
        "dist",
        "src/**/*.test.ts",
        "src/**/*.test-d.ts"
    ]
}
```

`packages/result-codec/tsconfig.test.json`:

```json
{
    "extends": "./tsconfig.json",
    "compilerOptions": {
        "noEmit": true,
        "types": ["node"]
    },
    "include": ["src/**/*.test.ts", "src/**/*.test-d.ts"],
    "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Scrivere l'implementazione minima**

`packages/result-codec/src/index.ts`:

```ts
import { TaggedError } from "@efesto-cloud/tagged-error";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export class EncodeError extends TaggedError("EncodeError")<{
    issues: readonly StandardSchemaV1.Issue[];
    branch: "ok" | "err";
}> {}

export class DecodeError extends TaggedError("DecodeError")<{
    issues: readonly StandardSchemaV1.Issue[];
    branch: "envelope" | "ok" | "err";
}> {}
```

`branch` dice al chiamante *dove* si è rotto il contratto: la busta, il ramo
di successo o quello d'errore. Senza, un `DecodeError` non è azionabile.

- [ ] **Step 6: Installare ed eseguire il test**

```bash
pnpm install
pnpm --filter @efesto-cloud/result-codec test
pnpm check-packages
```

Atteso: PASS, e `check-packages` con il conteggio incrementato.

- [ ] **Step 7: Commit**

```bash
git add packages/result-codec pnpm-lock.yaml
git commit -m "feat(result-codec): scaffolding e errori del codec"
```

---

### Task 2: `serialize` e `serializeUnsafe`

**Files:**
- Modify: `packages/result-codec/src/index.ts`
- Modify: `packages/result-codec/src/index.test.ts`

**Interfaces:**
- Consumes: `EncodeError` (Task 1); `Result`, `IResult`, `ok`, `err` da `@efesto-cloud/result`
- Produces:
  - `type InferOut<S> = StandardSchemaV1.InferOutput<S>`
  - `codec<OkS, ErrS>(schemas: { ok: OkS; err: ErrS }): ResultCodec<OkS, ErrS>`
  - `ResultCodec.serialize(result): Result<IResult<InferOut<OkS>, InferOut<ErrS>>, EncodeError>`
  - `ResultCodec.serializeUnsafe(result): IResult<InferOut<OkS>, InferOut<ErrS>>` — lancia `EncodeError`

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
import Result from "@efesto-cloud/result";
import { TaggedError, taggedErrorSchema } from "@efesto-cloud/tagged-error";
import { z } from "zod";
import { codec } from "./index.js";

class FooNotFound extends TaggedError("FooNotFound") {}

const UserSchema = z.object({ id: z.string(), nome: z.string() });
const UserCodec = codec({
    ok: UserSchema,
    err: taggedErrorSchema(FooNotFound),
});

test("serialize produce la busta piatta sul ramo ok", () => {
    const out = UserCodec.serialize(Result.ok({ id: "1", nome: "ada" }));
    assert.ok(out.isSuccess());
    assert.equal(out.data.success, true);
    assert.deepEqual(out.data.data, { id: "1", nome: "ada" });
});

test("serialize produce la busta piatta sul ramo err", () => {
    const out = UserCodec.serialize(Result.err(new FooNotFound()));
    assert.ok(out.isSuccess());
    assert.equal(out.data.success, false);
    assert.equal((out.data.error as FooNotFound)._tag, "FooNotFound");
});

test("serialize fallisce con EncodeError se il dato non rispetta lo schema", () => {
    const out = UserCodec.serialize(
        Result.ok({ id: 1, nome: "ada" } as never),
    );
    assert.ok(out.isFailure());
    assert.equal(out.error._tag, "EncodeError");
    assert.equal(out.error.branch, "ok");
    assert.ok(out.error.issues.length > 0);
});

test("serializeUnsafe lancia invece di restituire un Failure", () => {
    assert.doesNotThrow(() =>
        UserCodec.serializeUnsafe(Result.ok({ id: "1", nome: "ada" })),
    );
    assert.throws(
        () => UserCodec.serializeUnsafe(Result.ok({ id: 1 } as never)),
        (e: unknown) => e instanceof EncodeError,
    );
});

test("la busta serializzata sopravvive a JSON.stringify", () => {
    const wire = JSON.parse(
        JSON.stringify(UserCodec.serializeUnsafe(Result.err(new FooNotFound()))),
    );
    assert.equal(wire.success, false);
    assert.equal(wire.error._tag, "FooNotFound");
});
```

L'ultimo test verifica il contratto dichiarato nei vincoli globali: è
`JSON.stringify` a invocare `toJSON()`, non il codec.

- [ ] **Step 2: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/result-codec test
```

Atteso: FAIL — `codec` non è esportato.

- [ ] **Step 3: Implementare**

Aggiungere gli import:

```ts
import Result, { type IResult, err, ok } from "@efesto-cloud/result";
```

E l'implementazione:

```ts
type InferOut<S extends StandardSchemaV1> = StandardSchemaV1.InferOutput<S>;

const validateSync = <S extends StandardSchemaV1>(
    schema: S,
    value: unknown,
): StandardSchemaV1.Result<InferOut<S>> => {
    const out = schema["~standard"].validate(value);
    if (out instanceof Promise) {
        throw new TypeError(
            "result-codec richiede validatori sincroni; uno schema asincrono non e' supportato",
        );
    }
    return out as StandardSchemaV1.Result<InferOut<S>>;
};

export interface ResultCodec<
    OkS extends StandardSchemaV1,
    ErrS extends StandardSchemaV1,
> {
    serialize(
        result: Result<InferOut<OkS>, InferOut<ErrS>>,
    ): Result<IResult<InferOut<OkS>, InferOut<ErrS>>, EncodeError>;
    serializeUnsafe(
        result: Result<InferOut<OkS>, InferOut<ErrS>>,
    ): IResult<InferOut<OkS>, InferOut<ErrS>>;
}

export function codec<
    OkS extends StandardSchemaV1,
    ErrS extends StandardSchemaV1,
>(schemas: { ok: OkS; err: ErrS }): ResultCodec<OkS, ErrS> {
    const serialize = (
        result: Result<InferOut<OkS>, InferOut<ErrS>>,
    ): Result<IResult<InferOut<OkS>, InferOut<ErrS>>, EncodeError> => {
        if (result.isSuccess()) {
            const checked = validateSync(schemas.ok, result.data);
            if (checked.issues) {
                return err(
                    new EncodeError({ issues: checked.issues, branch: "ok" }),
                );
            }
        } else {
            const checked = validateSync(schemas.err, result.error);
            if (checked.issues) {
                return err(
                    new EncodeError({ issues: checked.issues, branch: "err" }),
                );
            }
        }
        return ok(result.toObject() as IResult<InferOut<OkS>, InferOut<ErrS>>);
    };

    return {
        serialize,
        serializeUnsafe: (result) => serialize(result).unwrapOrThrow(),
    };
}
```

`serializeUnsafe` è `serialize` più `unwrapOrThrow`: una sola implementazione,
nessuna possibilità che le due divergano.

- [ ] **Step 4: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/result-codec test
pnpm --filter @efesto-cloud/result-codec typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 5: Commit**

```bash
git add packages/result-codec/src
git commit -m "feat(result-codec): serialize e serializeUnsafe"
```

---

### Task 3: `deserialize` e `deserializeUnsafe`

Il doppio `Result` è il cuore del design: quello esterno riporta i guasti di
trasporto, quello interno l'esito di dominio.

**Files:**
- Modify: `packages/result-codec/src/index.ts`
- Modify: `packages/result-codec/src/index.test.ts`

**Interfaces:**
- Consumes: `codec` (Task 2), `DecodeError` (Task 1)
- Produces:
  - `ResultCodec.deserialize(input: unknown): Result<Result<InferOut<OkS>, InferOut<ErrS>>, DecodeError>`
  - `ResultCodec.deserializeUnsafe(input: unknown): Result<InferOut<OkS>, InferOut<ErrS>>` — lancia `DecodeError`

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
test("deserialize ricostruisce il ramo ok", () => {
    const wire = JSON.parse(
        JSON.stringify(UserCodec.serializeUnsafe(Result.ok({ id: "1", nome: "ada" }))),
    );
    const out = UserCodec.deserialize(wire);
    assert.ok(out.isSuccess());
    assert.ok(out.data.isSuccess());
    assert.deepEqual(out.data.data, { id: "1", nome: "ada" });
});

test("deserialize ricostruisce l'ISTANZA d'errore, non un oggetto piatto", () => {
    const wire = JSON.parse(
        JSON.stringify(UserCodec.serializeUnsafe(Result.err(new FooNotFound()))),
    );
    const out = UserCodec.deserialize(wire);
    assert.ok(out.isSuccess());
    assert.ok(out.data.isFailure());
    assert.ok(out.data.error instanceof FooNotFound);
});

test("una busta malformata da DecodeError con branch envelope", () => {
    for (const bad of [null, 42, "x", {}, { success: "forse" }]) {
        const out = UserCodec.deserialize(bad);
        assert.ok(out.isFailure(), `atteso fallimento per ${JSON.stringify(bad)}`);
        assert.equal(out.error._tag, "DecodeError");
        assert.equal(out.error.branch, "envelope");
    }
});

test("un payload che non rispetta lo schema da DecodeError con branch ok", () => {
    const out = UserCodec.deserialize({ success: true, data: { id: 1 } });
    assert.ok(out.isFailure());
    assert.equal(out.error.branch, "ok");
    assert.ok(out.error.issues.length > 0);
});

test("un tag d'errore sconosciuto da DecodeError con branch err", () => {
    const out = UserCodec.deserialize({
        success: false,
        error: { _tag: "MaiSentito" },
    });
    assert.ok(out.isFailure());
    assert.equal(out.error.branch, "err");
});

test("deserializeUnsafe lancia sul payload rotto", () => {
    assert.throws(
        () => UserCodec.deserializeUnsafe({ success: "forse" }),
        (e: unknown) => e instanceof DecodeError,
    );
});
```

Il secondo test è quello che giustifica l'intera fase: senza codec, un
`fromObject` restituirebbe un `Success` contenente un oggetto piatto, e il
guasto emergerebbe tre livelli più in là.

- [ ] **Step 2: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/result-codec test
```

Atteso: FAIL — `deserialize` non esiste sull'interfaccia.

- [ ] **Step 3: Estendere l'interfaccia**

Aggiungere a `ResultCodec`:

```ts
    deserialize(
        input: unknown,
    ): Result<Result<InferOut<OkS>, InferOut<ErrS>>, DecodeError>;
    deserializeUnsafe(
        input: unknown,
    ): Result<InferOut<OkS>, InferOut<ErrS>>;
```

- [ ] **Step 4: Implementare**

Dentro `codec`, accanto a `serialize`:

```ts
    const deserialize = (
        input: unknown,
    ): Result<Result<InferOut<OkS>, InferOut<ErrS>>, DecodeError> => {
        if (typeof input !== "object" || input === null) {
            return err(
                new DecodeError({
                    issues: [{ message: "Expected an object" }],
                    branch: "envelope",
                }),
            );
        }
        const envelope = input as { success?: unknown; data?: unknown; error?: unknown };
        if (typeof envelope.success !== "boolean") {
            return err(
                new DecodeError({
                    issues: [
                        { message: "Missing boolean `success`", path: ["success"] },
                    ],
                    branch: "envelope",
                }),
            );
        }

        if (envelope.success) {
            const checked = validateSync(schemas.ok, envelope.data);
            if (checked.issues) {
                return err(
                    new DecodeError({ issues: checked.issues, branch: "ok" }),
                );
            }
            return ok(Result.ok(checked.value));
        }

        const checked = validateSync(schemas.err, envelope.error);
        if (checked.issues) {
            return err(new DecodeError({ issues: checked.issues, branch: "err" }));
        }
        return ok(Result.err(checked.value));
    };
```

E aggiungerlo all'oggetto restituito:

```ts
    return {
        serialize,
        serializeUnsafe: (result) => serialize(result).unwrapOrThrow(),
        deserialize,
        deserializeUnsafe: (input) => deserialize(input).unwrapOrThrow(),
    };
```

- [ ] **Step 5: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/result-codec test
pnpm --filter @efesto-cloud/result-codec typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 6: Commit**

```bash
git add packages/result-codec/src
git commit -m "feat(result-codec): deserialize con distinzione fra guasto di trasporto ed esito di dominio"
```

---

### Task 4: Test end-to-end del confine loader → client

Un test che riproduce il caso d'uso reale: server serializza, il payload passa
per `JSON.stringify`/`JSON.parse`, il client deserializza e gestisce l'errore
con un `match` esaustivo — con lo stesso identico codice che userebbe il
server.

**Files:**
- Modify: `packages/result-codec/src/index.test.ts`
- Create: `packages/result-codec/src/index.test-d.ts`

**Interfaces:**
- Consumes: tutto quanto sopra
- Produces: nessuna API nuova

- [ ] **Step 1: Scrivere il test end-to-end**

```ts
class FooForbidden extends TaggedError("FooForbidden")<{ motivo: string }> {}

const FullCodec = codec({
    ok: UserSchema,
    err: taggedErrorSchema(FooNotFound, FooForbidden),
});

test("round trip completo: il client gestisce l'errore come il server", () => {
    // --- server
    const dominio = Result.err(new FooForbidden({ motivo: "ruolo" }));
    const wire = JSON.parse(JSON.stringify(FullCodec.serializeUnsafe(dominio)));

    // --- client
    const decoded = FullCodec.deserialize(wire);
    assert.ok(decoded.isSuccess(), "il payload deve essere valido");

    const status = decoded.data.match({
        ok: () => 200,
        err: (e) =>
            e.match({
                FooNotFound: () => 404,
                FooForbidden: (x) => (x.motivo === "ruolo" ? 403 : 400),
            }),
    });
    assert.equal(status, 403);
});

test("uno schema cambiato lato server si presenta come DecodeError, non come dato valido", () => {
    const vecchioPayload = { success: true, data: { id: "1" } }; // manca `nome`
    const decoded = FullCodec.deserialize(vecchioPayload);
    assert.ok(decoded.isFailure());
    assert.equal(decoded.error.branch, "ok");
});
```

- [ ] **Step 2: Scrivere i test type-level**

`packages/result-codec/src/index.test-d.ts`:

```ts
import Result from "@efesto-cloud/result";
import { TaggedError, taggedErrorSchema } from "@efesto-cloud/tagged-error";
import { z } from "zod";
import { codec } from "./index.js";

class FooNotFound extends TaggedError("FooNotFound") {}
class FooForbidden extends TaggedError("FooForbidden")<{ motivo: string }> {}

const UserSchema = z.object({ id: z.string(), nome: z.string() });
const c = codec({
    ok: UserSchema,
    err: taggedErrorSchema(FooNotFound, FooForbidden),
});

declare const input: unknown;
const decoded = c.deserialize(input);
if (decoded.isSuccess()) {
    // il match sull'errore deve restare esaustivo dopo il round trip
    const _status: number = decoded.data.match({
        ok: () => 200,
        err: (e) =>
            e.match({
                FooNotFound: () => 404,
                FooForbidden: (x) => x.motivo.length,
            }),
    });
    void _status;

    const _incomplete = decoded.data.match({
        ok: () => 200,
        // @ts-expect-error - manca l'handler per FooForbidden
        err: (e) => e.match({ FooNotFound: () => 404 }),
    });
    void _incomplete;
}

void c;
```

Questo file è il test più importante del package: verifica che l'esaustività
verificata dal compilatore **sopravviva al giro sulla rete**, che è la ragione
per cui esistono sia i tagged error sia il codec.

- [ ] **Step 3: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/result-codec test
pnpm --filter @efesto-cloud/result-codec typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 4: Commit**

```bash
git add packages/result-codec/src
git commit -m "test(result-codec): round trip end-to-end del confine loader/client"
```

---

### Task 5: Verifica finale e changeset

**Files:**
- Create: `.changeset/<nome-generato>.md`
- Modify: `knip.json` solo se knip segnala il package

- [ ] **Step 1: Eseguire la catena di verifica completa**

```bash
pnpm build
pnpm typecheck
pnpm exec biome check --write .
pnpm knip
pnpm check-packages
pnpm test
```

Atteso: tutti verdi. Se `knip` segnala `EncodeError`/`DecodeError`/`codec`
come inutilizzati, sono API pubblica: aggiungere l'entry a `knip.json` invece
di rimuoverli.

```json
        "packages/result-codec": {
            "entry": ["src/index.ts"]
        }
```

- [ ] **Step 2: Verificare il build emesso**

```bash
ls packages/result-codec/dist/
node -e "import('@efesto-cloud/result-codec').then(m => console.log(Object.keys(m)))"
```

Atteso: `index.js`, `index.d.ts` e sourcemap; gli export includono `codec`,
`EncodeError`, `DecodeError`.

- [ ] **Step 3: Creare il changeset**

```bash
pnpm changeset
```

Selezionare `@efesto-cloud/result-codec`, versione **minor** (package nuovo,
parte da `1.0.0`), con questa descrizione:

```
Nuovo package: valida i Result che attraversano un confine serializzato
(loader/action di React Router, code, persistenza) usando validatori
Standard Schema su entrambi i rami.

`deserialize` restituisce un Result annidato: quello esterno riporta i
guasti di trasporto — schema cambiato, versioni disallineate, payload
corrotto — quello interno l'esito di dominio. Con `taggedErrorSchema`
le istanze d'errore vengono ricostruite lato client, cosi' il match
esaustivo funziona identico ai due capi della rete.
```

- [ ] **Step 4: Commit**

```bash
git add .changeset knip.json
git commit -m "chore(result-codec): changeset per il rilascio iniziale"
```

---

## Self-Review

**Copertura della spec (§ 5):** `codec({ ok, err })` → Task 2. `serialize` /
`serializeUnsafe` → Task 2. `deserialize` / `deserializeUnsafe` con doppio
`Result` → Task 3. `EncodeError` / `DecodeError` come tagged error, con gli
`Issue` come props → Task 1. Linea guida d'uso (`serializeUnsafe` sul server,
`deserialize` sul client) → codificata nei test del Task 4. § 5.1
(`taggedErrorSchema`, reidratazione delle istanze) → implementato in Fase A,
verificato qui nel Task 3 e nel Task 4. § 10 (versioning) → Task 5.

**Scostamento dalla spec, dichiarato:** la spec ipotizzava il codec dentro
`@efesto-cloud/result`; la revisione l'ha spostato in un package proprio per
non accoppiare la primitiva né a `tagged-error` né a Standard Schema. La spec
riflette già questa decisione (§ 5).

**Coerenza dei tipi:** `InferOut<S>` è definito nel Task 2 e riusato nel Task
3. `validateSync` è definito nel Task 2 e riusato nel Task 3. `ResultCodec` è
dichiarato nel Task 2 con due metodi ed esteso nel Task 3 con gli altri due;
l'oggetto restituito da `codec` viene completato nello stesso Task 3.
`branch` ha valori `"ok" | "err"` su `EncodeError` e `"envelope" | "ok" |
"err"` su `DecodeError` — la differenza è intenzionale: in serializzazione la
busta la costruisce il codec, quindi non può essere malformata.
