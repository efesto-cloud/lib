import assert from "node:assert/strict";
import { test } from "node:test";
import { ok } from "@efesto-cloud/result";
import { errAsync, fromResult, okAsync } from "./index.js";

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
