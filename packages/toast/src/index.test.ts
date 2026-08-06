import assert from "node:assert/strict";
import { test } from "node:test";
import Toast from "./index.js";

test("match a oggetto instrada su entrambi i rami", () => {
    assert.equal(
        Toast.ok("fatto", 1).match({
            ok: (d) => `ok:${d}`,
            err: (e) => `err:${e}`,
        }),
        "ok:1",
    );
    assert.equal(
        Toast.err("rotto", "boom").match({
            ok: (d) => `ok:${d}`,
            err: (e) => `err:${e}`,
        }),
        "err:boom",
    );
});
