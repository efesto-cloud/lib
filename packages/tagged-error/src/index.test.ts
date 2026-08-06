import assert from "node:assert/strict";
import { test } from "node:test";
import type { AnyTaggedError } from "./index.js";
import { TaggedError } from "./index.js";

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
