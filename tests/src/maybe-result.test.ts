// Cross-package integration tests: verify @efesto-cloud/maybe and
// @efesto-cloud/result compose correctly across their boundary.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NoneError, none, some } from "@efesto-cloud/maybe";
import { ok } from "@efesto-cloud/result";

describe("Maybe <-> Result bridge", () => {
    it("some(x).toResult() yields a success carrying the value", () => {
        const r = some(42).toResult();
        assert.equal(r.isSuccess(), true);
        assert.equal(r.unwrapOr(0), 42);
    });

    it("none().toResult() yields a failure carrying a NoneError", () => {
        const r = none<number>().toResult();
        assert.equal(r.isFailure(), true);
        assert.equal(
            r.match(
                () => null,
                (e) => e instanceof NoneError,
            ),
            true,
        );
    });

    it("a Maybe pipeline can hand off to a Result pipeline", () => {
        const parsePositive = (input: number) =>
            some(input)
                .filter((n) => n > 0)
                .toResult()
                .map((n) => n * 10);

        assert.equal(parsePositive(5).unwrapOr(-1), 50);
        assert.equal(parsePositive(-5).isFailure(), true);
    });

    it("Result success can seed a Maybe-style fallback chain", () => {
        const value = ok<number, NoneError>(7).unwrapOr(
            none<number>().unwrapOr(0),
        );
        assert.equal(value, 7);
    });
});
