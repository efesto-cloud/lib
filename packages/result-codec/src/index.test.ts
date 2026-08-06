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
