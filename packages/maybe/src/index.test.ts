import assert from "node:assert/strict";
import { describe, it, test } from "node:test";
import Result from "@efesto-cloud/result";
import Maybe, {
    all,
    flatten,
    fromObject,
    fromResult,
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

    it("runs the some branch of fold and taps the value", () => {
        assert.equal(
            some(5).fold(
                () => "none",
                (n) => `some:${n}`,
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

    it("runs the none branch of fold and tapNone", () => {
        assert.equal(
            none<number>().fold(
                () => "none",
                (n) => `some:${n}`,
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

    it("namespace and named exports share one implementation", () => {
        assert.equal(Maybe.some, some);
        assert.equal(Maybe.none, none);
    });
});

test("match a oggetto instrada su entrambi i rami", () => {
    assert.equal(
        some(3).match({ some: (v) => `v:${v}`, none: () => "vuoto" }),
        "v:3",
    );
    assert.equal(
        none<number>().match({ some: (v) => `v:${v}`, none: () => "vuoto" }),
        "vuoto",
    );
});

test("all raccoglie in tupla e propaga il None", () => {
    const r = all([some(1), some("due")] as const);
    assert.ok(r.isSome());
    assert.deepEqual(r.data, [1, "due"]);
    assert.ok(all([some(1), none<string>()] as const).isNone());
    assert.ok(all([]).isSome());
});

test("toResult accetta un errore custom", () => {
    class MioErrore extends Error {}
    const r = none<number>().toResult(() => new MioErrore());
    assert.ok(r.isFailure());
    assert.ok(r.error instanceof MioErrore);
    assert.ok(none<number>().toResult().error instanceof NoneError);
    assert.equal(
        some(5)
            .toResult(() => new MioErrore())
            .unwrapOr(0),
        5,
    );
});

test("or ripiega su un altro Maybe", () => {
    assert.equal(some(1).or(some(2)).unwrapOr(0), 1);
    assert.equal(none<number>().or(some(2)).unwrapOr(0), 2);
    assert.ok(none<number>().or(none<number>()).isNone());
});

test("flatten appiattisce un Maybe annidato", () => {
    assert.equal(flatten(some(some(5))).unwrapOr(0), 5);
    assert.ok(flatten(some(none<number>())).isNone());
    assert.ok(flatten(none<Maybe<number>>()).isNone());
});

test("fromResult converte un Result", () => {
    assert.equal(fromResult(Result.ok(3)).unwrapOr(0), 3);
    assert.ok(fromResult(Result.err("x")).isNone());
});
