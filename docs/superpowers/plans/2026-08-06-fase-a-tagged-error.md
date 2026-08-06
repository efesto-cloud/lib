# Fase A — `@efesto-cloud/tagged-error` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pubblicare un package che permetta di dichiarare errori di dominio con un `_tag` letterale, ottenendo narrowing ed esaustività verificati dal compilatore e una serializzazione che sopravvive al confine di rete.

**Architettura:** Una class factory `TaggedError("Tag")` restituisce una classe generica nei props, da cui gli errori concreti derivano. Il metodo `match` è dichiarato **una sola volta** su una base astratta con parametro `this` polimorfico: è ciò che permette di chiamarlo su un *union* di errori. Sono forniti anche gli equivalenti data-last (`matchError`, `matchErrorPartial`) e un `taggedErrorSchema` che espone la reidratazione delle istanze come Standard Schema.

**Tech Stack:** TypeScript 6 (`^6.0.2`), Node ≥ 24, ESM-only, pnpm workspace, Biome 2.4.11, `node:test` via `tsx`, Changesets.

## Global Constraints

- Node `>=24`, pnpm `>=9`.
- ESM-only: `"type": "module"`, entry `dist/index.js`, tipi `dist/index.d.ts`.
- `exports` deve esporre sia `.` sia `./*`, puntando dentro `dist/`.
- `files: ["dist"]`, `license: "MIT"`, `publishConfig.access: "public"`.
- `repository`: `{ type: "git", url: "git+https://github.com/efesto-cloud/lib.git", directory: "packages/tagged-error" }` — obbligatorio, lo verifica `scripts/check-packages.mjs`.
- Biome: **indentazione 4 spazi**, LF, virgolette doppie, `organizeImports` attivo.
- Zero dipendenze runtime. L'unica dipendenza è `@standard-schema/spec`, che è **solo tipi**.
- Dopo ogni modifica, nell'ordine: `pnpm typecheck`, `pnpm exec biome check --write .`, `pnpm knip`.
- **Tutto il codice in questo piano è già stato compilato e verificato** (`tsc --strict`, TypeScript 6, più test runtime). Copialo verbatim: le firme dei tipi contengono dettagli non ovvi che, se semplificati, smettono di funzionare in silenzio.

---

## File Structure

| File | Responsabilità |
|------|----------------|
| `tsconfig.json` (root, **modifica**) | Alzare `target`/`lib` a ES2022 — serve per `ErrorOptions` e `new Error(msg, { cause })` |
| `packages/tagged-error/package.json` | Manifest |
| `packages/tagged-error/tsconfig.json` | Build config (esclude i test) |
| `packages/tagged-error/tsconfig.test.json` | Typecheck dei test |
| `packages/tagged-error/src/index.ts` | Tutta l'implementazione (segue la convenzione a file singolo del monorepo) |
| `packages/tagged-error/src/index.test.ts` | Test runtime (`node:test`) |
| `packages/tagged-error/src/index.test-d.ts` | Test type-level — **obbligatori**, vedi Task 5 |

---

### Task 1: Sbloccare `ErrorOptions` nel monorepo

Il `tsconfig.json` alla radice usa `"target": "ES2020"` e `"lib": ["ES2020"]`.
Con quella `lib`, `ErrorOptions` non esiste e `new Error(msg, { cause })` non
compila — entrambi indispensabili per questo package. Verificato:

```
error TS2554: Expected 0-1 arguments, but got 2.
error TS2304: Cannot find name 'ErrorOptions'.
```

Il salto a ES2022 è sicuro: `engines.node` è già `>=24`.

**Files:**
- Modify: `tsconfig.json` (righe `target` e `lib`)

**Interfaces:**
- Consumes: niente
- Produces: `ErrorOptions` e `Error(message, { cause })` disponibili in tutti i package

- [ ] **Step 1: Installare le dipendenze**

`tsx` è dichiarato in `devDependencies` ma il binario non è presente in
`node_modules/.bin/`. Senza, nessun test gira.

```bash
pnpm install
ls node_modules/.bin/tsx
```

Atteso: il path esiste.

- [ ] **Step 2: Verificare che il problema esista davvero**

```bash
cat > /tmp/erroroptions-probe.ts <<'EOF'
const o: ErrorOptions = { cause: 1 };
void o;
EOF
pnpm exec tsc --noEmit --strict --target es2020 --lib es2020 --skipLibCheck /tmp/erroroptions-probe.ts
```

Atteso: FAIL con `TS2304: Cannot find name 'ErrorOptions'`.

- [ ] **Step 3: Alzare target e lib**

In `tsconfig.json` alla radice:

```json
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "lib": ["ES2022"],
```

Non toccare nient'altro nel file.

- [ ] **Step 4: Verificare che l'intero monorepo compili ancora**

```bash
pnpm typecheck
```

Atteso: PASS su tutti i package. ES2022 è un superset di ES2020: alzare la
`lib` può solo aggiungere simboli, mai toglierne.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json
git commit -m "build: alza target e lib a ES2022

Serve per ErrorOptions e new Error(msg, { cause }), usati dai tagged
error. Sicuro: engines.node e' gia' >=24."
```

---

### Task 2: Scaffolding del package

**Files:**
- Create: `packages/tagged-error/package.json`
- Create: `packages/tagged-error/tsconfig.json`
- Create: `packages/tagged-error/tsconfig.test.json`
- Create: `packages/tagged-error/src/index.ts`
- Create: `packages/tagged-error/src/index.test.ts`

**Interfaces:**
- Consumes: niente
- Produces: package installabile e testabile, con `AnyTaggedError` esportato

- [ ] **Step 1: Scrivere il test che fallisce**

`packages/tagged-error/src/index.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AnyTaggedError } from "./index.js";

test("il package espone il tipo AnyTaggedError", () => {
    const e: AnyTaggedError = Object.assign(new Error("x"), {
        _tag: "Whatever" as const,
    });
    assert.equal(e._tag, "Whatever");
});
```

- [ ] **Step 2: Eseguirlo per verificare che fallisca**

```bash
pnpm --filter @efesto-cloud/tagged-error test
```

Atteso: FAIL — il package non esiste ancora, pnpm non trova il filtro.

- [ ] **Step 3: Creare il manifest**

`packages/tagged-error/package.json` — copiato dalla forma di
`packages/result/package.json`, che `check-packages.mjs` già approva:

```json
{
    "name": "@efesto-cloud/tagged-error",
    "version": "1.0.0",
    "description": "Tagged domain errors for efesto-cloud",
    "repository": {
        "type": "git",
        "url": "git+https://github.com/efesto-cloud/lib.git",
        "directory": "packages/tagged-error"
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
        "@standard-schema/spec": "^1.0.0"
    },
    "devDependencies": {
        "@types/node": "24"
    },
    "keywords": [],
    "license": "MIT",
    "publishConfig": {
        "access": "public"
    }
}
```

`@standard-schema/spec` sta in `dependencies` e non in `devDependencies`
perché i suoi tipi compaiono nella firma pubblica di `taggedErrorSchema`
(Task 7). È un package solo-tipi: non aggiunge niente al bundle. È
esattamente l'errore che `packages/result` ha oggi con `zod`, e che la Fase B
corregge.

- [ ] **Step 4: Creare i tsconfig**

`packages/tagged-error/tsconfig.json`:

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

`packages/tagged-error/tsconfig.test.json`:

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

`packages/tagged-error/src/index.ts`:

```ts
export type AnyTaggedError = Error & { readonly _tag: string };
```

- [ ] **Step 6: Installare e far passare il test**

```bash
pnpm install
pnpm --filter @efesto-cloud/tagged-error test
```

Atteso: PASS, 1 test.

- [ ] **Step 7: Verificare i controlli del monorepo**

```bash
pnpm check-packages
```

Atteso: `check-packages: N public packages OK`, con N incrementato di uno.

- [ ] **Step 8: Commit**

```bash
git add packages/tagged-error pnpm-lock.yaml
git commit -m "feat(tagged-error): scaffolding del package"
```

---

### Task 3: La factory `TaggedError`

**Files:**
- Modify: `packages/tagged-error/src/index.ts`
- Modify: `packages/tagged-error/src/index.test.ts`

**Interfaces:**
- Consumes: `AnyTaggedError` (Task 2)
- Produces:
  - `TaggedErrorBase` — classe astratta con `abstract readonly _tag: string`
  - `TaggedErrorCtor<Tag extends string>` — interfaccia del costruttore restituito
  - `TaggedError<Tag extends string>(tag: Tag): TaggedErrorCtor<Tag>`
  - ogni istanza ha `_tag: Tag`, `name: Tag`, i props come readonly, ed è un `Error`
  - `<Classe>.is(u: unknown): u is …` e `<Classe>._tag`

- [ ] **Step 1: Scrivere i test che falliscono**

Aggiungere a `packages/tagged-error/src/index.test.ts`:

```ts
import { TaggedError } from "./index.js";

class CartNotFound extends TaggedError("CartNotFound") {}
class OutOfStock extends TaggedError("OutOfStock")<{ sku: string }> {}

test("gli errori senza props si costruiscono a vuoto", () => {
    const e = new CartNotFound();
    assert.equal(e._tag, "CartNotFound");
    assert.equal(e.name, "CartNotFound");
    assert.ok(e instanceof CartNotFound);
    assert.ok(e instanceof Error);
});

test("i props dichiarati diventano proprieta dell'istanza", () => {
    const e = new OutOfStock({ sku: "ABC-1" });
    assert.equal(e.sku, "ABC-1");
    assert.equal(e._tag, "OutOfStock");
});

test("message e cause vengono passati a Error", () => {
    const cause = new OutOfStock({ sku: "X" });
    const e = new CartNotFound({ message: "carrello sparito", cause });
    assert.equal(e.message, "carrello sparito");
    assert.equal(e.cause, cause);
});

test("i props riservati non sovrascrivono l'identita", () => {
    const e = new OutOfStock({
        sku: "X",
        _tag: "Fake",
        name: "Fake",
    } as never);
    assert.equal(e._tag, "OutOfStock");
    assert.equal(e.name, "OutOfStock");
    assert.equal(e.sku, "X");
});

test("is() discrimina sul tag, non sul prototype", () => {
    assert.ok(OutOfStock.is(new OutOfStock({ sku: "X" })));
    assert.ok(!OutOfStock.is(new CartNotFound()));
    assert.ok(!OutOfStock.is({ _tag: "OutOfStock" }));
    assert.equal(OutOfStock._tag, "OutOfStock");
});

test("lo stack trace e preservato", () => {
    const e = new OutOfStock({ sku: "X" });
    assert.ok(typeof e.stack === "string");
    assert.ok(e.stack.includes("OutOfStock"));
});
```

- [ ] **Step 2: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/tagged-error test
```

Atteso: FAIL — `TaggedError` non è esportato.

- [ ] **Step 3: Scrivere l'implementazione**

Aggiungere a `packages/tagged-error/src/index.ts`:

```ts
export abstract class TaggedErrorBase extends Error {
    abstract readonly _tag: string;
}

type CtorArgs<Props extends object> = object extends Props
    ? [props?: Props & ErrorOptions & { message?: string }]
    : [props: Props & ErrorOptions & { message?: string }];

export interface TaggedErrorCtor<Tag extends string> {
    new <Props extends object = object>(
        ...args: CtorArgs<Props>
    ): TaggedErrorBase &
        Readonly<Props> & { readonly _tag: Tag; readonly name: Tag };
    readonly _tag: Tag;
    is(u: unknown): u is TaggedErrorBase & { readonly _tag: Tag };
}

const RESERVED = new Set(["_tag", "name", "message", "cause", "stack"]);

export function TaggedError<Tag extends string>(
    tag: Tag,
): TaggedErrorCtor<Tag> {
    class Impl extends TaggedErrorBase {
        readonly _tag = tag;
        static readonly _tag = tag;

        constructor(props?: Record<string, unknown> & ErrorOptions) {
            const message = props?.message;
            const cause = props?.cause;
            super(
                typeof message === "string" ? message : undefined,
                cause !== undefined ? { cause } : undefined,
            );
            this.name = tag;
            if (props) {
                for (const [k, v] of Object.entries(props)) {
                    if (!RESERVED.has(k)) {
                        (this as unknown as Record<string, unknown>)[k] = v;
                    }
                }
            }
        }

        static is(u: unknown): u is Impl {
            return u instanceof Error && (u as { _tag?: unknown })._tag === tag;
        }
    }
    return Impl as unknown as TaggedErrorCtor<Tag>;
}
```

Tre dettagli da non "semplificare":

- **`CtorArgs` con `object extends Props`** è ciò che rende il costruttore
  chiamabile a vuoto quando non ci sono props e obbligatorio quando ce ne
  sono. È la condizione che preserva la convenzione parameterless.
- **`RESERVED`** evita che props provenienti dalla rete sovrascrivano
  `_tag`/`name`. I field initializer girano subito dopo `super()`, quindi
  senza il filtro l'assegnazione dei props li calpesterebbe.
- **`is()` controlla `_tag`, non `instanceof Impl`**: così funziona anche
  cross-realm.

- [ ] **Step 4: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/tagged-error test
pnpm --filter @efesto-cloud/tagged-error typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 5: Commit**

```bash
git add packages/tagged-error/src
git commit -m "feat(tagged-error): factory TaggedError con _tag, props e is()"
```

---

### Task 4: `toJSON`

`message` è una proprietà own **non enumerabile** di `Error`: senza `toJSON`
si perde in qualunque serializzazione. Lo stesso vale per `cause`.

**Files:**
- Modify: `packages/tagged-error/src/index.ts`
- Modify: `packages/tagged-error/src/index.test.ts`

**Interfaces:**
- Consumes: `TaggedErrorBase` (Task 3)
- Produces: `TaggedErrorBase.prototype.toJSON(): Record<string, unknown>`, che emette `{ ...props, _tag, name, message }` più `cause` se definita

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
test("toJSON emette tag, name, message e props", () => {
    const e = new OutOfStock({ sku: "ABC-1", message: "esaurito" });
    const json = e.toJSON();
    assert.equal(json._tag, "OutOfStock");
    assert.equal(json.name, "OutOfStock");
    assert.equal(json.message, "esaurito");
    assert.equal(json.sku, "ABC-1");
});

test("toJSON include cause solo se definita", () => {
    assert.equal("cause" in new CartNotFound().toJSON(), false);
    const withCause = new CartNotFound({ cause: new OutOfStock({ sku: "X" }) });
    assert.ok(withCause.toJSON().cause !== undefined);
});

test("il tag sopravvive a JSON.stringify", () => {
    const e = new OutOfStock({ sku: "ABC-1" });
    const wire = JSON.parse(JSON.stringify({ error: e }));
    assert.equal(wire.error._tag, "OutOfStock");
    assert.equal(wire.error.sku, "ABC-1");
});
```

- [ ] **Step 2: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/tagged-error test
```

Atteso: FAIL — `toJSON` non esiste su `TaggedErrorBase`.

- [ ] **Step 3: Implementare**

Aggiungere dentro `TaggedErrorBase`, dopo la dichiarazione di `_tag`:

```ts
    toJSON(): Record<string, unknown> {
        const self = this as unknown as Record<string, unknown> & Error;
        return {
            ...self,
            _tag: self._tag,
            name: self.name,
            message: self.message,
            ...(self.cause !== undefined ? { cause: self.cause } : {}),
        };
    }
```

- [ ] **Step 4: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/tagged-error test
```

Atteso: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tagged-error/src
git commit -m "feat(tagged-error): toJSON che preserva message e cause"
```

---

### Task 5: Il metodo `match` — il cuore del package

Questa è la parte tecnicamente delicata. La firma qui sotto **è stata
compilata e verificata**; tre suoi dettagli sono controintuitivi e, se
rimossi, degradano in silenzio invece di dare errore.

**Files:**
- Modify: `packages/tagged-error/src/index.ts`
- Modify: `packages/tagged-error/src/index.test.ts`
- Create: `packages/tagged-error/src/index.test-d.ts`

**Interfaces:**
- Consumes: `TaggedErrorBase` (Task 3)
- Produces:
  - `TagHandlers<Self extends { readonly _tag: string }, R>` — mappa tag → handler
  - `TaggedErrorBase.prototype.match(handlers)` — chiamabile su un union, ritorna l'union dei ritorni degli handler

- [ ] **Step 1: Scrivere i test runtime che falliscono**

```ts
test("match instrada sul tag corretto", () => {
    const err: CartNotFound | OutOfStock = new OutOfStock({ sku: "ABC-1" });
    const out = err.match({
        CartNotFound: () => "nessun carrello",
        OutOfStock: (e) => `esaurito ${e.sku}`,
    });
    assert.equal(out, "esaurito ABC-1");
});

test("match funziona anche su un errore concreto singolo", () => {
    const out = new OutOfStock({ sku: "X" }).match({
        OutOfStock: (e) => e.sku,
    });
    assert.equal(out, "X");
});
```

- [ ] **Step 2: Scrivere i test type-level che falliscono**

`packages/tagged-error/src/index.test-d.ts` — questi test valgono più di
quelli runtime: una regressione dell'inferenza (ritorno che collassa a
`unknown`, esaustività che smette di scattare) non verrebbe colta a runtime.

```ts
import { TaggedError } from "./index.js";

class CartNotFound extends TaggedError("CartNotFound") {}
class EmptyCart extends TaggedError("EmptyCart") {}
class OutOfStock extends TaggedError("OutOfStock")<{ sku: string }> {}

type CheckoutError = CartNotFound | EmptyCart | OutOfStock;
declare const error: CheckoutError;

// narrowing dentro l'handler: `e` deve essere OutOfStock, non l'union
const _narrowed: number = error.match({
    CartNotFound: () => 404,
    EmptyCart: () => 400,
    OutOfStock: (e) => e.sku.length,
});

// il ritorno e l'union dei ritorni degli handler, non `unknown`
const _mixed: string | number | boolean | null = error.match({
    CartNotFound: () => "not-found" as const,
    EmptyCart: () => 0,
    OutOfStock: () => true,
});

// @ts-expect-error - manca l'handler per OutOfStock
const _incomplete = error.match({
    CartNotFound: () => 404,
    EmptyCart: () => 400,
});

const _extraKey = error.match({
    CartNotFound: () => 404,
    EmptyCart: () => 400,
    OutOfStock: () => 409,
    // @ts-expect-error - variante inesistente
    NonEsiste: () => 500,
});

void _narrowed;
void _mixed;
void _incomplete;
void _extraKey;
```

Nota: `_mixed` non elenca `OutOfStock` fra i tipi di ritorno perché
`() => true` è `boolean`. L'annotazione esplicita serve proprio a far fallire
il test se l'inferenza collassasse a `unknown`.

- [ ] **Step 3: Eseguire entrambi per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/tagged-error test
pnpm --filter @efesto-cloud/tagged-error typecheck:test
```

Atteso: FAIL — `match` non esiste.

- [ ] **Step 4: Implementare**

Aggiungere in `packages/tagged-error/src/index.ts`, prima di `TaggedErrorBase`:

```ts
export type TagHandlers<Self extends { readonly _tag: string }, R> = {
    [K in Self["_tag"]]: (error: Extract<Self, { readonly _tag: K }>) => R;
};
```

E dentro `TaggedErrorBase`:

```ts
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
```

**I tre dettagli da non toccare:**

1. **`match` va dichiarato una sola volta, sulla base, con `this: Self`.**
   È ciò che rende la chiamata possibile su un union: tutte le sottoclassi
   ereditano la stessa identica firma, TypeScript la deduplica e resta una
   sola signature generica. Dichiararlo sulle classi concrete non funziona —
   TypeScript rifiuta l'unione di più signature generiche.
2. **Va inferito `H`, non `R`.** Con `handlers: TagHandlers<Self, R>` il tipo
   di ritorno collassa a `unknown` appena gli handler ritornano tipi diversi.
   Il test `_mixed` è lì per catturare esattamente questa regressione.
3. **`& Record<Exclude<keyof H, Self["_tag"]>, never>` è necessario.**
   Inferendo `H` dal literal, l'excess property check non scatta più: senza
   quell'intersezione un handler con un tag scritto male verrebbe accettato e
   non eseguito mai. Il test `_extraKey` copre questo.

- [ ] **Step 5: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/tagged-error test
pnpm --filter @efesto-cloud/tagged-error typecheck:test
```

Atteso: PASS entrambi. Se `typecheck:test` segnala
`Unused '@ts-expect-error' directive`, significa che l'esaustività **non**
sta scattando: è un fallimento, non un falso positivo.

- [ ] **Step 6: Commit**

```bash
git add packages/tagged-error/src
git commit -m "feat(tagged-error): match esaustivo su union di errori"
```

---

### Task 6: `matchError` e `matchErrorPartial`

Le forme data-last, per chi preferisce la funzione al metodo, e la variante
parziale con `otherwise` — quest'ultima è l'escape hatch che rende
sopportabile la migrazione dei `core` (vedi § 7 della spec).

**Files:**
- Modify: `packages/tagged-error/src/index.ts`
- Modify: `packages/tagged-error/src/index.test.ts`
- Modify: `packages/tagged-error/src/index.test-d.ts`

**Interfaces:**
- Consumes: `TagHandlers` (Task 5), `AnyTaggedError` (Task 2)
- Produces:
  - `PartialTagHandlers<Self>` — `Partial<TagHandlers<Self, unknown>> & { otherwise: (error: Self) => unknown }`
  - `matchError(error, handlers)` — esaustivo, stessa semantica del metodo
  - `matchErrorPartial(error, handlers)` — handler parziali più `otherwise` obbligatorio

- [ ] **Step 1: Scrivere i test runtime che falliscono**

```ts
import { matchError, matchErrorPartial } from "./index.js";

test("matchError instrada come il metodo", () => {
    const err: CartNotFound | OutOfStock = new OutOfStock({ sku: "ABC-1" });
    assert.equal(
        matchError(err, {
            CartNotFound: () => "no",
            OutOfStock: (e) => e.sku,
        }),
        "ABC-1",
    );
});

test("matchErrorPartial cade su otherwise per i tag non gestiti", () => {
    const err: CartNotFound | OutOfStock = new CartNotFound();
    assert.equal(
        matchErrorPartial(err, {
            OutOfStock: (e) => e.sku,
            otherwise: () => "fallback",
        }),
        "fallback",
    );
});

test("matchErrorPartial preferisce l'handler specifico a otherwise", () => {
    const err: CartNotFound | OutOfStock = new OutOfStock({ sku: "S" });
    assert.equal(
        matchErrorPartial(err, {
            OutOfStock: (e) => e.sku,
            otherwise: () => "fallback",
        }),
        "S",
    );
});
```

- [ ] **Step 2: Scrivere i test type-level che falliscono**

Aggiungere a `index.test-d.ts`:

```ts
import { matchError, matchErrorPartial } from "./index.js";

const _fn: number = matchError(error, {
    CartNotFound: () => 404,
    EmptyCart: () => 400,
    OutOfStock: (e) => e.sku.length,
});

// @ts-expect-error - handler mancante anche nella forma data-last
const _fnIncomplete = matchError(error, { CartNotFound: () => 404 });

const _partial: number = matchErrorPartial(error, {
    CartNotFound: () => 404,
    OutOfStock: (e) => e.sku.length,
    otherwise: () => 500,
});

// @ts-expect-error - otherwise e obbligatorio
const _noOtherwise = matchErrorPartial(error, { CartNotFound: () => 404 });

void _fn;
void _fnIncomplete;
void _partial;
void _noOtherwise;
```

- [ ] **Step 3: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/tagged-error test
pnpm --filter @efesto-cloud/tagged-error typecheck:test
```

Atteso: FAIL — le due funzioni non sono esportate.

- [ ] **Step 4: Implementare**

```ts
export type PartialTagHandlers<Self extends { readonly _tag: string }> =
    Partial<TagHandlers<Self, unknown>> & {
        otherwise: (error: Self) => unknown;
    };

export function matchError<
    Self extends AnyTaggedError,
    H extends TagHandlers<Self, unknown>,
>(
    error: Self,
    handlers: H & Record<Exclude<keyof H, Self["_tag"]>, never>,
): ReturnType<H[keyof H]> {
    const table = handlers as unknown as Record<
        string,
        (e: Self) => ReturnType<H[keyof H]>
    >;
    return table[error._tag](error);
}

export function matchErrorPartial<
    Self extends AnyTaggedError,
    H extends PartialTagHandlers<Self>,
>(error: Self, handlers: H): ReturnType<NonNullable<H[keyof H]>> {
    const table = handlers as unknown as Record<
        string,
        ((e: Self) => ReturnType<NonNullable<H[keyof H]>>) | undefined
    >;
    const handler = table[error._tag] ?? table.otherwise;
    if (handler === undefined) {
        throw new TypeError(`No handler for tag "${error._tag}"`);
    }
    return handler(error);
}
```

Il `throw` è irraggiungibile con tipi corretti (`otherwise` è obbligatorio):
serve solo come rete per chiamanti JavaScript non tipizzati.

- [ ] **Step 5: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/tagged-error test
pnpm --filter @efesto-cloud/tagged-error typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 6: Commit**

```bash
git add packages/tagged-error/src
git commit -m "feat(tagged-error): matchError e matchErrorPartial data-last"
```

---

### Task 7: `taggedErrorSchema` — reidratazione via Standard Schema

Permette al codec della Fase C di ricostruire **istanze vere** dal payload di
rete, così che nel client `error instanceof FooNotFoundError` funzioni e il
codice di gestione errori sia identico a quello del server.

**Files:**
- Modify: `packages/tagged-error/src/index.ts`
- Modify: `packages/tagged-error/src/index.test.ts`
- Modify: `packages/tagged-error/src/index.test-d.ts`

**Interfaces:**
- Consumes: `AnyTaggedError` (Task 2), `TaggedError` (Task 3)
- Produces:
  - `AnyTaggedErrorClass` — `{ new (...args: any[]): AnyTaggedError; readonly _tag: string }`
  - `taggedErrorSchema<C extends readonly AnyTaggedErrorClass[]>(...classes: C): StandardSchemaV1<unknown, InstanceType<C[number]>>`

- [ ] **Step 1: Scrivere i test runtime che falliscono**

```ts
import { taggedErrorSchema } from "./index.js";

test("lo schema reidrata l'istanza concreta dal payload", () => {
    const schema = taggedErrorSchema(CartNotFound, OutOfStock);
    const wire = JSON.parse(
        JSON.stringify({ error: new OutOfStock({ sku: "ABC-1" }) }),
    );
    const out = schema["~standard"].validate(wire.error);
    assert.ok(!(out instanceof Promise));
    assert.equal(out.issues, undefined);
    const revived = (out as { value: unknown }).value;
    assert.ok(revived instanceof OutOfStock);
    assert.equal((revived as OutOfStock).sku, "ABC-1");
    assert.equal((revived as OutOfStock)._tag, "OutOfStock");
});

test("un tag sconosciuto produce un issue, non un'eccezione", () => {
    const schema = taggedErrorSchema(CartNotFound);
    const out = schema["~standard"].validate({ _tag: "Sconosciuto" });
    assert.ok(!(out instanceof Promise));
    assert.ok(out.issues !== undefined);
});

test("un input non-oggetto produce un issue", () => {
    const schema = taggedErrorSchema(CartNotFound);
    for (const bad of [null, 42, "stringa", undefined]) {
        const out = schema["~standard"].validate(bad);
        assert.ok(!(out instanceof Promise));
        assert.ok(out.issues !== undefined, `atteso issue per ${String(bad)}`);
    }
});

test("_tag mancante produce un issue", () => {
    const schema = taggedErrorSchema(CartNotFound);
    const out = schema["~standard"].validate({ sku: "X" });
    assert.ok(!(out instanceof Promise));
    assert.ok(out.issues !== undefined);
});
```

- [ ] **Step 2: Scrivere il test type-level che fallisce**

Aggiungere a `index.test-d.ts`:

```ts
import { taggedErrorSchema } from "./index.js";

const _schema = taggedErrorSchema(CartNotFound, EmptyCart, OutOfStock);
const _out = _schema["~standard"].validate({ _tag: "OutOfStock", sku: "A" });
if (!(_out instanceof Promise) && _out.issues === undefined) {
    // l'output deve essere l'union delle classi concrete, non AnyTaggedError
    const _e: CartNotFound | EmptyCart | OutOfStock = _out.value;
    void _e;
}
void _schema;
```

Questo test è il motivo per cui `AnyTaggedErrorClass` usa
`new (...args: any[])`: con un costruttore tipizzato più stretto, le classi
con props obbligatorie non sono assegnabili e `InstanceType<C[number]>`
collassa a `AnyTaggedError`. Entrambi gli errori sono stati riscontrati.

- [ ] **Step 3: Eseguirli per verificare che falliscano**

```bash
pnpm --filter @efesto-cloud/tagged-error test
pnpm --filter @efesto-cloud/tagged-error typecheck:test
```

Atteso: FAIL — `taggedErrorSchema` non è esportato.

- [ ] **Step 4: Implementare**

In cima al file, con gli altri import:

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
```

E in fondo:

```ts
export type AnyTaggedErrorClass = {
    // biome-ignore lint/suspicious/noExplicitAny: deve accettare qualunque forma concreta di props
    new (...args: any[]): AnyTaggedError;
    readonly _tag: string;
};

export function taggedErrorSchema<C extends readonly AnyTaggedErrorClass[]>(
    ...classes: C
): StandardSchemaV1<unknown, InstanceType<C[number]>> {
    const byTag = new Map<string, AnyTaggedErrorClass>(
        classes.map((c) => [c._tag, c]),
    );
    return {
        "~standard": {
            version: 1,
            vendor: "efesto-cloud",
            validate: (value: unknown) => {
                if (typeof value !== "object" || value === null) {
                    return { issues: [{ message: "Expected an object" }] };
                }
                const tag = (value as { _tag?: unknown })._tag;
                if (typeof tag !== "string") {
                    return {
                        issues: [{ message: "Missing `_tag`", path: ["_tag"] }],
                    };
                }
                const Cls = byTag.get(tag);
                if (Cls === undefined) {
                    return {
                        issues: [
                            {
                                message: `Unknown error tag "${tag}"`,
                                path: ["_tag"],
                            },
                        ],
                    };
                }
                return {
                    value: new Cls(
                        value as Record<string, unknown>,
                    ) as InstanceType<C[number]>,
                };
            },
        },
    };
}
```

Non serve ripulire `_tag`/`name` dal payload prima di passarlo al
costruttore: il filtro `RESERVED` del Task 3 lo fa già.

- [ ] **Step 5: Eseguire i test**

```bash
pnpm --filter @efesto-cloud/tagged-error test
pnpm --filter @efesto-cloud/tagged-error typecheck:test
```

Atteso: PASS entrambi.

- [ ] **Step 6: Commit**

```bash
git add packages/tagged-error/src
git commit -m "feat(tagged-error): taggedErrorSchema con reidratazione delle istanze"
```

---

### Task 8: Verifica finale e changeset

**Files:**
- Create: `.changeset/<nome-generato>.md`
- Modify: `knip.json` solo se knip segnala il package

**Interfaces:**
- Consumes: tutto quanto sopra
- Produces: package pronto al rilascio

- [ ] **Step 1: Eseguire la catena di verifica completa**

```bash
pnpm typecheck
pnpm exec biome check --write .
pnpm knip
pnpm check-packages
pnpm --filter @efesto-cloud/tagged-error test
pnpm --filter @efesto-cloud/tagged-error typecheck:test
pnpm --filter @efesto-cloud/tagged-error build
```

Atteso: tutti verdi. Se `knip` segnala export inutilizzati nel package nuovo,
**non** rimuoverli: sono API pubblica. Aggiungere invece l'entry a
`knip.json`:

```json
        "packages/tagged-error": {
            "entry": ["src/index.ts"]
        }
```

- [ ] **Step 2: Verificare il build emesso**

```bash
ls packages/tagged-error/dist/
node -e "import('@efesto-cloud/tagged-error').then(m => console.log(Object.keys(m)))"
```

Atteso: `index.js`, `index.d.ts`, più le sourcemap; gli export includono
`TaggedError`, `matchError`, `matchErrorPartial`, `taggedErrorSchema`,
`TaggedErrorBase`.

- [ ] **Step 3: Creare il changeset**

```bash
pnpm changeset
```

Selezionare `@efesto-cloud/tagged-error`, versione **minor** (il package è
nuovo, parte da `1.0.0`), con questa descrizione:

```
Nuovo package: errori di dominio con `_tag` letterale, `match` esaustivo
verificato dal compilatore, `matchError`/`matchErrorPartial` data-last,
`toJSON` che preserva message e cause, e `taggedErrorSchema` per
reidratare le istanze da un payload di rete.
```

- [ ] **Step 4: Commit**

```bash
git add .changeset knip.json
git commit -m "chore(tagged-error): changeset per il rilascio iniziale"
```

---

## Self-Review

**Copertura della spec (§ 1):** `TaggedError` → Task 3. `match` esaustivo →
Task 5. `matchError`/`matchErrorPartial` → Task 6. `taggedErrorSchema` →
Task 7. `AnyTaggedError`/`TagHandlers` → Task 2 e 5. `toJSON` → Task 4.
`is()` e `_tag` statico → Task 3. Forma del package e `check-packages` →
Task 2 e 8. Test type-level obbligatori (§ 8) → Task 5, 6, 7. Versioning
(§ 10) → Task 8.

**Fuori dal piano, di proposito:** la regola di lint tag ↔ nome classe, che la
spec classifica come follow-up.

**Prerequisito non previsto dalla spec:** il Task 1 (ES2022) è emerso in fase
di piano verificando che `ErrorOptions` non è disponibile con la `lib`
attuale. Va aggiunto anche alla spec se questa viene rivista.

**Coerenza dei tipi:** `TagHandlers` è definito nel Task 5 e riusato nel Task
6 con la stessa firma. `AnyTaggedError` è definito nel Task 2 e usato nei
Task 6 e 7. `TaggedErrorBase` è definito nel Task 3, esteso nel Task 4
(`toJSON`) e nel Task 5 (`match`). `AnyTaggedErrorClass` esiste solo nel Task
7. Nessun riferimento a simboli non definiti.
