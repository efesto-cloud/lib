import assert from "node:assert/strict";
import { test } from "node:test";
import type { AnyTaggedError } from "./index.js";
import {
    matchError,
    matchErrorPartial,
    TaggedError,
    taggedErrorSchema,
} from "./index.js";

test("il package espone il tipo AnyTaggedError", () => {
    const e: AnyTaggedError = Object.assign(new Error("x"), {
        _tag: "Whatever" as const,
    });
    assert.equal(e._tag, "Whatever");
});

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

test("match instrada sul tag corretto", () => {
    // Il cast esplicito e necessario: senza, TypeScript restringe il tipo di
    // `err` al tipo del valore assegnato (OutOfStock) tramite control-flow
    // narrowing, nonostante l'annotazione union — e la signature di `match`,
    // che infierisce Self da `this`, vedrebbe solo OutOfStock invece
    // dell'union dichiarata, facendo fallire il typecheck sull'handler
    // CartNotFound come proprieta in eccesso.
    const err: CartNotFound | OutOfStock = new OutOfStock({
        sku: "ABC-1",
    }) as CartNotFound | OutOfStock;
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

test("matchError instrada come il metodo", () => {
    // Il cast esplicito e necessario: senza, TypeScript restringe il tipo di
    // `err` al tipo del valore assegnato (OutOfStock) tramite control-flow
    // narrowing, nonostante l'annotazione union — vedi il commento su "match
    // instrada sul tag corretto" sopra.
    const err: CartNotFound | OutOfStock = new OutOfStock({
        sku: "ABC-1",
    }) as CartNotFound | OutOfStock;
    assert.equal(
        matchError(err, {
            CartNotFound: () => "no",
            OutOfStock: (e) => e.sku,
        }),
        "ABC-1",
    );
});

test("matchErrorPartial cade su otherwise per i tag non gestiti", () => {
    // Stesso difetto di narrowing del test precedente: senza il cast, `err`
    // si restringe a CartNotFound e l'handler OutOfStock perde il tipo del
    // suo parametro.
    const err: CartNotFound | OutOfStock = new CartNotFound() as
        | CartNotFound
        | OutOfStock;
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
