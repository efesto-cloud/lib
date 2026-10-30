import assert from "node:assert/strict";
import { test } from "node:test";
import { noneAsync, someAsync } from "./index.js";

test("match a oggetto instrada su entrambi i rami", async () => {
    assert.equal(
        await someAsync(1).match({
            some: (v) => `v:${v}`,
            none: () => "vuoto",
        }),
        "v:1",
    );
    assert.equal(
        await noneAsync<number>().match({
            some: (v) => `v:${v}`,
            none: () => "vuoto",
        }),
        "vuoto",
    );
});
