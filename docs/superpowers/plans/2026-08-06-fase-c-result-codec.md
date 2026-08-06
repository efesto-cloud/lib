# Fase C — `@efesto-cloud/result-codec` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare un contratto verificato al confine dove i `Result` vengono serializzati — loader/action di React Router verso il client — distinguendo *"il dominio ha detto no"* da *"il payload non è quello che ci aspettavamo"*.

**Architettura:** Un `codec({ serialize, deserialize })` costruito su **quattro** validatori Standard Schema, uno per ramo **per direzione**. `serialize` valida il ramo attivo e produce la busta piatta `IResult`; `deserialize` valida prima la busta, poi il ramo, e restituisce un `Result` la cui unione d'errore include `DecodeError` accanto agli errori di dominio.

**Tech Stack:** TypeScript 6 (`^6.0.2`), Node ≥ 24, ESM-only, pnpm workspace, Biome 2.4.11, `node:test` via `tsx`, Changesets.

**Dipende dalle Fasi A e B.** Non iniziare prima che entrambe siano su `main`.

## Global Constraints

- Node `>=24`, pnpm `>=9`, ESM-only, forma di package standard del monorepo.
- `repository.directory` deve essere `packages/result-codec`.
- Biome: **indentazione 4 spazi**, LF, virgolette doppie.
- Dipendenze: `@efesto-cloud/result` (`workspace:*`), `@efesto-cloud/tagged-error` (`workspace:*`), `@standard-schema/spec` (`^1.0.0`, solo tipi).
- **Il codec è sincrono.** Standard Schema ammette validatori asincroni; il nostro confine no — il client deserializza durante il render di React Router, dove non si può attendere una Promise. Se uno schema restituisce una Promise, si lancia un `TypeError`, come fa `fromSchema` in Fase B.
- **La busta resta `IResult`** (`{ success, data, error }`), non `{ status, value }`: è già la forma che `toObject`/`fromObject` e `@efesto-cloud/toast` producono in tutta l'organizzazione.
- `serialize` **non** chiama `toJSON()` esplicitamente: restituisce la busta con l'istanza d'errore così com'è. La conversione avviene quando `JSON.stringify` (o `Response.json`) invoca `toJSON()` — contratto standard di JavaScript, ed è ciò che fanno sia React Router sia `Response.json`. Chiamarlo a mano renderebbe il valore a runtime diverso dal tipo dichiarato.
- Dopo ogni modifica, nell'ordine: `pnpm typecheck`, `pnpm exec biome check --write .`, `pnpm knip`.
- Eseguire `pnpm install` solo come `CI=true pnpm install`.

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

```json
{
    "name": "@efesto-cloud/result-codec",
    "version": "0.0.0",
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

`version` è `0.0.0` di proposito: con un changeset `major` il package debutta esattamente a `1.0.0` (vedi Task 5). `zod` è solo per i test — serve uno schema Standard Schema concreto.

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

`branch` dice al chiamante *dove* si è rotto il contratto: la busta, il ramo di successo o quello d'errore. Senza, un `DecodeError` non è azionabile. In serializzazione `"envelope"` non compare: la busta la costruisce il codec, quindi non può essere malformata.

- [ ] **Step 6: Installare ed eseguire il test**

```bash
CI=true pnpm install
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

### Task 2: `codec()` con quattro schemi, `serialize` e `serializeUnsafe`

**Files:**
- Modify: `packages/result-codec/src/index.ts`
- Modify: `packages/result-codec/src/index.test.ts`

**Interfaces:**
- Consumes: `EncodeError` (Task 1); `Result`, `IResult`, `ok`, `err` da `@efesto-cloud/result`
- Produces:
  - `codec({ serialize: { ok, err }, deserialize: { ok, err } })`
  - `ResultCodec.serialize(result)` → `Result<IResult<OkWire, ErrWire>, EncodeError>`
  - `ResultCodec.serializeUnsafe(result)` → `IResult<OkWire, ErrWire>`, lancia `EncodeError`

**Perché quattro schemi.** Uno schema per **direzione**, non per ramo. Con un solo schema per ramo, la ricostruzione delle istanze dovrebbe avvenire dentro `validate` — un effetto collaterale che a un validatore non compete, e che nella prima stesura ha prodotto sia la mancata validazione dei props sia un buco di prototype pollution. Separando le direzioni, `deserialize.err` è uno schema vero che valida i props, e la forma sul filo può differire da quella di dominio (`Date` ↔ stringa ISO).

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
import Result from "@efesto-cloud/result";
import { TaggedError, taggedErrorSchema } from "@efesto-cloud/tagged-error";
import { z } from "zod";
import { codec } from "./index.js";

class FooNotFound extends TaggedError("FooNotFound") {}

const UserSchema = z.object({ id: z.string(), nome: z.string() });
const ErrSchema = taggedErrorSchema(FooNotFound);

const UserCodec = codec({
    serialize: { ok: UserSchema, err: ErrSchema },
    deserialize: { ok: UserSchema, err: ErrSchema },
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
    const out = UserCodec.serialize(Result.ok({ id: 1, nome: "ada" } as never));
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

test("uno schema asincrono lancia un TypeError", () => {
    const asyncSchema = {
        "~standard": {
            version: 1 as const,
            vendor: "test",
            validate: () => Promise.resolve({ value: 1 }),
        },
    };
    const c = codec({
        serialize: { ok: asyncSchema, err: ErrSchema },
        deserialize: { ok: asyncSchema, err: ErrSchema },
    });
    assert.throws(() => c.serialize(Result.ok(1)), TypeError);
});
```

L'ultimo test sulla busta verifica il contratto dichiarato nei vincoli globali: è `JSON.stringify` a invocare `toJSON()`, non il codec.

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
type In<S extends StandardSchemaV1> = StandardSchemaV1.InferInput<S>;
type Out<S extends StandardSchemaV1> = StandardSchemaV1.InferOutput<S>;

const validateSync = <S extends StandardSchemaV1>(
    schema: S,
    value: unknown,
): StandardSchemaV1.Result<Out<S>> => {
    const out = schema["~standard"].validate(value);
    if (out instanceof Promise) {
        throw new TypeError(
            "result-codec richiede validatori sincroni: il client deserializza durante il render",
        );
    }
    return out as StandardSchemaV1.Result<Out<S>>;
};

export interface CodecSchemas<
    SOk extends StandardSchemaV1,
    SErr extends StandardSchemaV1,
    DOk extends StandardSchemaV1,
    DErr extends StandardSchemaV1,
> {
    serialize: { ok: SOk; err: SErr };
    deserialize: { ok: DOk; err: DErr };
}

export interface ResultCodec<
    SOk extends StandardSchemaV1,
    SErr extends StandardSchemaV1,
    DOk extends StandardSchemaV1,
    DErr extends StandardSchemaV1,
> {
    serialize(
        result: Result<In<SOk>, In<SErr>>,
    ): Result<IResult<Out<SOk>, Out<SErr>>, EncodeError>;
    serializeUnsafe(
        result: Result<In<SOk>, In<SErr>>,
    ): IResult<Out<SOk>, Out<SErr>>;
}

export function codec<
    SOk extends StandardSchemaV1,
    SErr extends StandardSchemaV1,
    DOk extends StandardSchemaV1,
    DErr extends StandardSchemaV1,
>(
    schemas: CodecSchemas<SOk, SErr, DOk, DErr>,
): ResultCodec<SOk, SErr, DOk, DErr> {
    const serialize = (
        result: Result<In<SOk>, In<SErr>>,
    ): Result<IResult<Out<SOk>, Out<SErr>>, EncodeError> => {
        if (result.isSuccess()) {
            const checked = validateSync(schemas.serialize.ok, result.data);
            if (checked.issues) {
                return err(
                    new EncodeError({ issues: checked.issues, branch: "ok" }),
                );
            }
            return ok({ success: true, data: checked.value, error: undefined });
        }
        const checked = validateSync(schemas.serialize.err, result.error);
        if (checked.issues) {
            return err(
                new EncodeError({ issues: checked.issues, branch: "err" }),
            );
        }
        return ok({ success: false, data: undefined, error: checked.value });
    };

    return {
        serialize,
        serializeUnsafe: (result) => serialize(result).unwrapOrThrow(),
    };
}
```

Due dettagli deliberati:

- La busta viene costruita con il valore **validato** (`checked.value`), non con `result.toObject()`: è il valore che lo schema di serializzazione ha prodotto, che può differire da quello di dominio.
- `serializeUnsafe` è `serialize` più `unwrapOrThrow`: una sola implementazione, nessuna possibilità che le due divergano.

- [ ] **Step 4: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/result-codec test
pnpm --filter @efesto-cloud/result-codec typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 5: Commit**

```bash
git add packages/result-codec/src
git commit -m "feat(result-codec): codec a quattro schemi con serialize"
```

---

### Task 3: `deserialize` e `deserializeUnsafe` — unione piatta

**Files:**
- Modify: `packages/result-codec/src/index.ts`
- Modify: `packages/result-codec/src/index.test.ts`

**Interfaces:**
- Consumes: `codec` (Task 2), `DecodeError` (Task 1)
- Produces:
  - `ResultCodec.deserialize(input: unknown)` → `Result<Out<DOk>, Out<DErr> | DecodeError>`
  - `ResultCodec.deserializeUnsafe(input: unknown)` → `Result<Out<DOk>, Out<DErr>>`, lancia `DecodeError`

**Perché un'unione piatta e non un `Result` annidato.** La distinzione fra "il dominio ha detto no" e "il payload non è quello che ci aspettavamo" resta essenziale, ma si ottiene dal **tag**: `DecodeError` entra nel canale errori come un'altra variante e si gestisce con lo stesso `matchError` di tutte le altre. Un doppio `Result` costringerebbe ogni consumatore a scartare due livelli prima di arrivare al dato, proprio dove serve di più — nel componente.

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
test("deserialize ricostruisce il ramo ok", () => {
    const wire = JSON.parse(
        JSON.stringify(UserCodec.serializeUnsafe(Result.ok({ id: "1", nome: "ada" }))),
    );
    const out = UserCodec.deserialize(wire);
    assert.ok(out.isSuccess());
    assert.deepEqual(out.data, { id: "1", nome: "ada" });
});

test("deserialize ricostruisce l'ISTANZA d'errore, non un oggetto piatto", () => {
    const wire = JSON.parse(
        JSON.stringify(UserCodec.serializeUnsafe(Result.err(new FooNotFound()))),
    );
    const out = UserCodec.deserialize(wire);
    assert.ok(out.isFailure());
    assert.ok(out.error instanceof FooNotFound);
});

test("una busta malformata da DecodeError con branch envelope", () => {
    for (const bad of [null, 42, "x", [], {}, { success: "forse" }]) {
        const out = UserCodec.deserialize(bad);
        assert.ok(out.isFailure(), `atteso fallimento per ${JSON.stringify(bad)}`);
        assert.ok(DecodeError.is(out.error));
        assert.equal(out.error.branch, "envelope");
    }
});

test("un payload che non rispetta lo schema da DecodeError con branch ok", () => {
    const out = UserCodec.deserialize({ success: true, data: { id: 1 } });
    assert.ok(out.isFailure());
    assert.ok(DecodeError.is(out.error));
    assert.equal(out.error.branch, "ok");
    assert.ok(out.error.issues.length > 0);
});

test("un tag d'errore sconosciuto da DecodeError con branch err", () => {
    const out = UserCodec.deserialize({
        success: false,
        error: { _tag: "MaiSentito" },
    });
    assert.ok(out.isFailure());
    assert.ok(DecodeError.is(out.error));
    assert.equal(out.error.branch, "err");
});

test("l'errore di dominio e quello di trasporto si distinguono per tag", () => {
    const dominio = UserCodec.deserialize({
        success: false,
        error: { _tag: "FooNotFound" },
    });
    assert.ok(dominio.isFailure());
    assert.ok(FooNotFound.is(dominio.error));
    assert.ok(!DecodeError.is(dominio.error));

    const trasporto = UserCodec.deserialize({ success: "forse" });
    assert.ok(trasporto.isFailure());
    assert.ok(DecodeError.is(trasporto.error));
});

test("deserializeUnsafe lancia sul payload rotto ma non sull'errore di dominio", () => {
    assert.throws(
        () => UserCodec.deserializeUnsafe({ success: "forse" }),
        (e: unknown) => e instanceof DecodeError,
    );
    const dominio = UserCodec.deserializeUnsafe({
        success: false,
        error: { _tag: "FooNotFound" },
    });
    assert.ok(dominio.isFailure());
    assert.ok(dominio.error instanceof FooNotFound);
});
```

Il secondo test è quello che giustifica l'intera fase: senza codec, un `fromObject` restituirebbe un `Success` contenente un oggetto piatto, e il guasto emergerebbe tre livelli più in là. L'ultimo è ciò che distingue questa forma da un `Result` annidato: `deserializeUnsafe` lancia solo sul guasto di trasporto, lasciando intatto l'esito di dominio.

- [ ] **Step 2: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/result-codec test
```

Atteso: FAIL — `deserialize` non esiste sull'interfaccia.

- [ ] **Step 3: Estendere l'interfaccia**

Aggiungere a `ResultCodec`:

```ts
    deserialize(input: unknown): Result<Out<DOk>, Out<DErr> | DecodeError>;
    deserializeUnsafe(input: unknown): Result<Out<DOk>, Out<DErr>>;
```

- [ ] **Step 4: Implementare**

Dentro `codec`, accanto a `serialize`:

```ts
    const decodeErr = (
        issues: readonly StandardSchemaV1.Issue[],
        branch: "envelope" | "ok" | "err",
    ) => err(new DecodeError({ issues, branch }));

    const deserialize = (
        input: unknown,
    ): Result<Out<DOk>, Out<DErr> | DecodeError> => {
        if (typeof input !== "object" || input === null || Array.isArray(input)) {
            return decodeErr([{ message: "Expected an object" }], "envelope");
        }
        const envelope = input as {
            success?: unknown;
            data?: unknown;
            error?: unknown;
        };
        if (typeof envelope.success !== "boolean") {
            return decodeErr(
                [{ message: "Missing boolean `success`", path: ["success"] }],
                "envelope",
            );
        }

        if (envelope.success) {
            const checked = validateSync(schemas.deserialize.ok, envelope.data);
            return checked.issues
                ? decodeErr(checked.issues, "ok")
                : ok(checked.value);
        }

        const checked = validateSync(schemas.deserialize.err, envelope.error);
        return checked.issues
            ? decodeErr(checked.issues, "err")
            : err(checked.value);
    };
```

E completare l'oggetto restituito:

```ts
    return {
        serialize,
        serializeUnsafe: (result) => serialize(result).unwrapOrThrow(),
        deserialize,
        deserializeUnsafe: (input) => {
            const r = deserialize(input);
            if (r.isFailure() && DecodeError.is(r.error)) throw r.error;
            return r as Result<Out<DOk>, Out<DErr>>;
        },
    };
```

`deserializeUnsafe` **non** è `deserialize().unwrapOrThrow()`: lancerebbe anche sugli errori di dominio, che sono un esito legittimo. Lancia solo su `DecodeError`, riconosciuto col guard `.is()` — che verifica il tag, quindi funziona anche cross-realm.

- [ ] **Step 5: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/result-codec test
pnpm --filter @efesto-cloud/result-codec typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 6: Commit**

```bash
git add packages/result-codec/src
git commit -m "feat(result-codec): deserialize con DecodeError nel canale errori"
```

---

### Task 4: Round trip end-to-end e test type-level

Un test che riproduce il caso d'uso reale: il server serializza, il payload passa per `JSON.stringify`/`JSON.parse`, il client deserializza e gestisce tutto — errori di dominio e guasto di trasporto — con un unico `matchError` esaustivo.

**Files:**
- Modify: `packages/result-codec/src/index.test.ts`
- Create: `packages/result-codec/src/index.test-d.ts`

**Interfaces:**
- Consumes: tutto quanto sopra
- Produces: nessuna API nuova

- [ ] **Step 1: Scrivere il test end-to-end**

```ts
import { matchError } from "@efesto-cloud/tagged-error";

class FooForbidden extends TaggedError("FooForbidden")<{ motivo: string }> {}

const FullErrSchema = taggedErrorSchema(FooNotFound, FooForbidden);
const FullCodec = codec({
    serialize: { ok: UserSchema, err: FullErrSchema },
    deserialize: { ok: UserSchema, err: FullErrSchema },
});

test("round trip completo: un solo match copre dominio e trasporto", () => {
    // --- server
    const dominio = Result.err(new FooForbidden({ motivo: "ruolo" }));
    const wire = JSON.parse(JSON.stringify(FullCodec.serializeUnsafe(dominio)));

    // --- client
    const decoded = FullCodec.deserialize(wire);
    assert.ok(decoded.isFailure());

    const status = matchError(decoded.error, {
        FooNotFound: () => 404,
        FooForbidden: (e) => (e.motivo === "ruolo" ? 403 : 400),
        DecodeError: () => 502,
    });
    assert.equal(status, 403);
});

test("uno schema cambiato lato server si presenta come DecodeError, non come dato valido", () => {
    const vecchioPayload = { success: true, data: { id: "1" } }; // manca `nome`
    const decoded = FullCodec.deserialize(vecchioPayload);
    assert.ok(decoded.isFailure());
    assert.ok(DecodeError.is(decoded.error));
    assert.equal(decoded.error.branch, "ok");
});

test("i props dell'errore vengono validati, non solo il tag", () => {
    // FooForbidden richiede `motivo`: un payload che lo omette non passa
    const PropsSchema = z.object({
        _tag: z.literal("FooForbidden"),
        motivo: z.string(),
    });
    const StrictCodec = codec({
        serialize: { ok: UserSchema, err: PropsSchema },
        deserialize: { ok: UserSchema, err: PropsSchema },
    });
    const out = StrictCodec.deserialize({
        success: false,
        error: { _tag: "FooForbidden" },
    });
    assert.ok(out.isFailure());
    assert.ok(DecodeError.is(out.error));
    assert.equal(out.error.branch, "err");
});
```

Il terzo test è la ragione per cui esistono quattro schemi invece di due: con uno schema di `deserialize` proprio, i props d'errore vengono validati come qualunque altro payload.

- [ ] **Step 2: Scrivere i test type-level**

`packages/result-codec/src/index.test-d.ts`:

```ts
import Result from "@efesto-cloud/result";
import { TaggedError, matchError, taggedErrorSchema } from "@efesto-cloud/tagged-error";
import { z } from "zod";
import { DecodeError, codec } from "./index.js";

class FooNotFound extends TaggedError("FooNotFound") {}
class FooForbidden extends TaggedError("FooForbidden")<{ motivo: string }> {}

const UserSchema = z.object({ id: z.string(), nome: z.string() });
const ErrSchema = taggedErrorSchema(FooNotFound, FooForbidden);
const c = codec({
    serialize: { ok: UserSchema, err: ErrSchema },
    deserialize: { ok: UserSchema, err: ErrSchema },
});

declare const input: unknown;
const decoded = c.deserialize(input);

if (decoded.isFailure()) {
    // l'esaustività deve coprire dominio E trasporto, e sopravvivere al round trip
    const _status: number = matchError(decoded.error, {
        FooNotFound: () => 404,
        FooForbidden: (e) => e.motivo.length,
        DecodeError: (e) => e.issues.length,
    });
    void _status;

    // @ts-expect-error - manca l'handler per DecodeError
    const _incomplete = matchError(decoded.error, {
        FooNotFound: () => 404,
        FooForbidden: () => 403,
    });
    void _incomplete;
}

if (decoded.isSuccess()) {
    const _user: { id: string; nome: string } = decoded.data;
    void _user;
}

// deserializeUnsafe toglie DecodeError dall'unione
const unsafe = c.deserializeUnsafe(input);
if (unsafe.isFailure()) {
    const _onlyDomain: FooNotFound | FooForbidden = unsafe.error;
    void _onlyDomain;
}

void c;
void DecodeError;
void Result;
```

Questo file è il test più importante del package: verifica che l'esaustività verificata dal compilatore **sopravviva al giro sulla rete**, e che `deserializeUnsafe` restringa davvero l'unione togliendo `DecodeError`.

- [ ] **Step 3: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/result-codec test
pnpm --filter @efesto-cloud/result-codec typecheck:test
```

Atteso: PASS entrambi. Se `typecheck:test` segnala `Unused '@ts-expect-error' directive`, l'esaustività **non** sta scattando: è un fallimento, non un falso positivo.

- [ ] **Step 4: Commit**

```bash
git add packages/result-codec/src
git commit -m "test(result-codec): round trip end-to-end del confine loader/client"
```

---

### Task 5: Verifica finale e changeset

**Files:**
- Create: `.changeset/result-codec-initial.md`
- Modify: `knip.json` solo se knip segnala il package

- [ ] **Step 1: Eseguire la catena di verifica completa**

```bash
CI=true pnpm build
CI=true pnpm typecheck
pnpm exec biome check --write .
CI=true pnpm knip
pnpm check-packages
CI=true pnpm test
```

Atteso: tutti verdi. Se `knip` segnala `EncodeError`/`DecodeError`/`codec` come inutilizzati, sono API pubblica: aggiungere l'entry a `knip.json` invece di rimuoverli.

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

Atteso: `index.js`, `index.d.ts` e sourcemap; gli export includono `codec`, `EncodeError`, `DecodeError`.

- [ ] **Step 3: Scrivere il changeset**

`pnpm changeset` è interattivo: scrivere il file direttamente in `.changeset/result-codec-initial.md`. Il manifest è a `0.0.0`, quindi un bump `major` produce esattamente `1.0.0`.

```
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
```

- [ ] **Step 4: Commit**

```bash
git add .changeset knip.json
git commit -m "chore(result-codec): changeset per il rilascio iniziale"
```

---

## Self-Review

**Copertura della spec (§ 5):** quattro schemi (§ 5.1) → Task 2. Superficie e unione piatta (§ 5.2) → Task 2 e 3. Codec sincrono (§ 5.3) → vincolo globale, testato in Task 2. Busta `IResult` (§ 5.4) → Task 2. `taggedErrorSchema` come comodità componibile (§ 5.5) → Task 2 e 4, con il test sui props validati che dimostra l'alternativa. Politica su `cause` (§ 5.6) → implementata in Fase A, nessun lavoro qui. Versioning (§ 10) → Task 1 (`0.0.0`) e Task 5 (`major`).

**Differenze rispetto alla stesura precedente di questo piano:** il codec passa da due schemi a quattro; `deserialize` passa da `Result<Result<Ok, Err>, DecodeError>` a `Result<Ok, Err | DecodeError>`; `deserializeUnsafe` smette di essere `unwrapOrThrow` e lancia solo su `DecodeError`; la busta viene costruita dal valore validato invece che da `toObject()`; il manifest parte da `0.0.0` con changeset `major` invece di `1.0.0` con `minor`.

**Coerenza dei tipi:** `In<S>`/`Out<S>` sono definiti nel Task 2 e riusati nel Task 3. `validateSync` è definito nel Task 2 e riusato nel Task 3. `CodecSchemas` e `ResultCodec` sono dichiarati nel Task 2 con due metodi ed estesi nel Task 3 con gli altri due; l'oggetto restituito da `codec` viene completato nello stesso Task 3. `branch` ha valori `"ok" | "err"` su `EncodeError` e `"envelope" | "ok" | "err"` su `DecodeError` — la differenza è intenzionale: in serializzazione la busta la costruisce il codec.
