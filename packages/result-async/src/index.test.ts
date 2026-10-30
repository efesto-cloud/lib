import assert from "node:assert/strict";
import { test } from "node:test";
import { ok } from "@efesto-cloud/result";
import {
    allAsync,
    errAsync,
    fromPromise,
    fromResult,
    okAsync,
    partitionAsync,
} from "./index.js";

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
        ok: (d) => {
            visti.push(`ok:${d}`);
        },
        err: (e) => {
            visti.push(`err:${e}`);
        },
    });
    assert.deepEqual(visti, ["ok:1"]);
    assert.ok(r.isSuccess());
});

test("fromResult fa da ponte sync -> async", async () => {
    const r = await fromResult(ok<number, string>(2)).andThen(async (n) =>
        ok<number, string>(n * 2),
    );
    assert.ok(r.isSuccess());
    assert.equal(r.data, 4);
});

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

test("allAsync ritorna l'errore in ordine di input anche se non è il primo a risolversi nel tempo", async () => {
    // "primo" e' il primo elemento nell'array di input, ma si risolve DOPO
    // "secondo" (che e' immediato). Se l'implementazione scegliesse l'errore
    // in base a quale promise si risolve prima nel tempo, restituirebbe
    // "secondo" invece di "primo". Promise.all + il corto-circuito di `all`
    // in ordine di iterazione garantiscono che vinca "primo".
    const primo = fromPromise<number, string>(
        new Promise((_resolve, reject) => {
            setTimeout(() => reject("primo"), 20);
        }),
        (caught) => caught as string,
    );
    const secondo = errAsync<string, number>("secondo");

    const r = await allAsync([primo, secondo]);
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
