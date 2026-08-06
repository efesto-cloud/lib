import assert from "node:assert/strict";
import { test } from "node:test";
import type { AnyTaggedError } from "./index.js";

test("il package espone il tipo AnyTaggedError", () => {
    const e: AnyTaggedError = Object.assign(new Error("x"), {
        _tag: "Whatever" as const,
    });
    assert.equal(e._tag, "Whatever");
});
