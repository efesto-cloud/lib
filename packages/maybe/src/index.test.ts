import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Maybe, {
    combine,
    fromObject,
    fromThrowable,
    maybe,
    NoneError,
    none,
    some,
} from "./index.js";

describe("Some", () => {
    it("is some and not none", () => {
        const m = some(1);
        assert.equal(m.isSome(), true);
        assert.equal(m.isNone(), false);
        assert.equal(m.some, true);
        assert.equal(m.data, 1);
    });

    it("maps and chains the value", () => {
        assert.equal(
            some(2)
                .map((n) => n * 3)
                .unwrapOr(0),
            6,
        );
        assert.equal(
            some(2)
                .flatMap((n) => some(n + 1))
                .unwrapOr(0),
            3,
        );
        assert.equal(
            some(2)
                .andThen(() => none<number>())
                .unwrapOr(-1),
            -1,
        );
    });

    it("filters to none when the predicate fails", () => {
        assert.equal(
            some(4)
                .filter((n) => n > 10)
                .isNone(),
            true,
        );
        assert.equal(
            some(4)
                .filter((n) => n > 0)
                .unwrapOr(0),
            4,
        );
    });

    it("runs the some branch of match/fold and taps the value", () => {
        assert.equal(
            some(5).match(
                (n) => `some:${n}`,
                () => "none",
            ),
            "some:5",
        );
        let seen: number | undefined;
        let tappedNone = false;
        some(5)
            .tap((n) => {
                seen = n;
            })
            .tapNone(() => {
                tappedNone = true;
            });
        assert.equal(seen, 5);
        assert.equal(tappedNone, false);
    });

    it("unwraps and converts to an ok Result", () => {
        assert.equal(some(9).unwrapOrThrow(), 9);
        assert.equal(some(9).toResult().isSuccess(), true);
        assert.deepEqual(some(9).toObject(), { some: true, data: 9 });
    });
});

describe("None", () => {
    it("is none and not some", () => {
        const m = none();
        assert.equal(m.isNone(), true);
        assert.equal(m.isSome(), false);
        assert.equal(m.some, false);
        assert.equal(m.data, null);
    });

    it("short-circuits map/flatMap/filter", () => {
        assert.equal(
            none<number>()
                .map((n) => n * 2)
                .isNone(),
            true,
        );
        assert.equal(
            none<number>()
                .flatMap((n) => some(n))
                .isNone(),
            true,
        );
    });

    it("runs the none branch of match/fold and tapNone", () => {
        assert.equal(
            none<number>().match(
                (n) => `some:${n}`,
                () => "none",
            ),
            "none",
        );
        let tapped = false;
        none<number>().tapNone(() => {
            tapped = true;
        });
        assert.equal(tapped, true);
    });

    it("recovers via else and returns the fallback", () => {
        assert.equal(none<number>().unwrapOr(7), 7);
        assert.equal(
            none<number>()
                .else(() => 42)
                .unwrapOr(0),
            42,
        );
    });

    it("throws NoneError and converts to a failing Result", () => {
        assert.throws(() => none().unwrapOrThrow(), NoneError);
        assert.equal(none<number>().toResult().isFailure(), true);
        assert.deepEqual(none().toObject(), { some: false, data: null });
    });
});

describe("factories", () => {
    it("maybe() lifts nullish into none and values into some", () => {
        assert.equal(maybe(0).unwrapOr(-1), 0);
        assert.equal(maybe("").unwrapOr("fallback"), "");
        assert.equal(maybe<number>(null).isNone(), true);
        assert.equal(maybe<number>(undefined).isNone(), true);
    });

    it("fromObject round-trips toObject", () => {
        assert.equal(fromObject(some(1).toObject()).unwrapOr(0), 1);
        assert.equal(fromObject(none().toObject()).isNone(), true);
    });

    it("fromThrowable maps throws and nullish to none", () => {
        const head = fromThrowable((xs: number[]) => {
            if (xs.length === 0) throw new Error("empty");
            return xs[0];
        });
        assert.equal(head([1, 2]).unwrapOr(-1), 1);
        assert.equal(head([]).isNone(), true);
    });

    it("combine joins two somes and collapses on any none", () => {
        assert.deepEqual(combine(some(1), some("a")).unwrapOrThrow(), [1, "a"]);
        assert.equal(combine(some(1), none<string>()).isNone(), true);
    });

    it("namespace and named exports share one implementation", () => {
        assert.equal(Maybe.some, some);
        assert.equal(Maybe.none, none);
    });
});
