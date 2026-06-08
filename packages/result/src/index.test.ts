import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Result, { err, fromObject, fromThrowable, ok } from "./index.js";

describe("Success", () => {
    it("is a success and not a failure", () => {
        const r = ok(1);
        assert.equal(r.isSuccess(), true);
        assert.equal(r.isFailure(), false);
        assert.equal(r.success, true);
        assert.equal(r.data, 1);
        assert.equal(r.error, undefined);
    });

    it("maps the data and leaves errors untouched", () => {
        assert.equal(
            ok(2)
                .map((n) => n * 3)
                .unwrapOr(0),
            6,
        );
        assert.equal(
            ok<number, string>(2)
                .mapError((e) => `${e}!`)
                .unwrapOr(0),
            2,
        );
    });

    it("chains with flatMap/andThen", () => {
        const r = ok(2).flatMap((n) => ok(n + 1));
        assert.equal(r.unwrapOr(0), 3);
        assert.equal(
            ok(2)
                .andThen(() => err<string>("boom"))
                .unwrapOr(-1),
            -1,
        );
    });

    it("ignores orElse and runs the ok branch of match/fold", () => {
        assert.equal(
            ok(5)
                .orElse(() => ok(0))
                .unwrapOr(-1),
            5,
        );
        assert.equal(
            ok(5).match(
                (n) => `ok:${n}`,
                () => "err",
            ),
            "ok:5",
        );
        assert.equal(
            ok(5).fold(
                () => "err",
                (n) => `ok:${n}`,
            ),
            "ok:5",
        );
    });

    it("taps the value, skips tapError", () => {
        let seen: number | undefined;
        let tappedError = false;
        ok(7)
            .tap((n) => {
                seen = n;
            })
            .tapError(() => {
                tappedError = true;
            });
        assert.equal(seen, 7);
        assert.equal(tappedError, false);
    });

    it("unwraps without throwing", () => {
        assert.equal(ok(9).unwrapOrThrow(), 9);
        assert.deepEqual(ok(9).toObject(), {
            success: true,
            data: 9,
            error: undefined,
        });
    });
});

describe("Failure", () => {
    it("is a failure and not a success", () => {
        const r = err<string>("nope");
        assert.equal(r.isFailure(), true);
        assert.equal(r.isSuccess(), false);
        assert.equal(r.success, false);
        assert.equal(r.error, "nope");
        assert.equal(r.data, undefined);
    });

    it("short-circuits map/flatMap and transforms the error", () => {
        const r = err<string>("e")
            .map((n: number) => n * 2)
            .flatMap((n: number) => ok(n));
        assert.equal(r.isFailure(), true);
        assert.equal(
            err<string>("e")
                .mapError((e) => `${e}!`)
                .match(
                    () => "ok",
                    (e) => e,
                ),
            "e!",
        );
    });

    it("recovers via orElse and runs the err branch of match/fold", () => {
        assert.equal(
            err<string, number>("e")
                .orElse(() => ok(42))
                .unwrapOr(-1),
            42,
        );
        assert.equal(
            err<string>("e").match(
                () => "ok",
                (e) => `err:${e}`,
            ),
            "err:e",
        );
        assert.equal(
            err<string>("e").fold(
                (e) => `err:${e}`,
                () => "ok",
            ),
            "err:e",
        );
    });

    it("taps the error, skips tap, returns the fallback", () => {
        let seen: string | undefined;
        let tappedOk = false;
        err<string>("x")
            .tap(() => {
                tappedOk = true;
            })
            .tapError((e) => {
                seen = e;
            });
        assert.equal(seen, "x");
        assert.equal(tappedOk, false);
        assert.equal(err<string>("x").unwrapOr(0), 0);
    });

    it("throws the raw error on unwrapOrThrow", () => {
        assert.throws(() => err(new Error("boom")).unwrapOrThrow(), /boom/);
    });
});

describe("factories", () => {
    it("fromObject round-trips toObject", () => {
        assert.equal(fromObject(ok(1).toObject()).unwrapOr(0), 1);
        assert.equal(fromObject(err<string>("e").toObject()).isFailure(), true);
    });

    it("fromThrowable captures thrown errors", () => {
        const parse = fromThrowable(
            (s: string) => JSON.parse(s) as unknown,
            (caught) => (caught as Error).message,
        );
        assert.equal(parse('{"a":1}').isSuccess(), true);
        assert.equal(parse("not json").isFailure(), true);
    });

    it("namespace and named exports share one implementation", () => {
        assert.equal(Result.ok, ok);
        assert.equal(Result.err, err);
    });
});
