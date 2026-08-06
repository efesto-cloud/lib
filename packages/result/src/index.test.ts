import assert from "node:assert/strict";
import { describe, it, test } from "node:test";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod";
import Result, {
    all,
    err,
    flatten,
    fromObject,
    fromSchema,
    fromThrowable,
    isErr,
    isOk,
    ok,
    partition,
} from "./index.js";

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
            ok(5).match({
                ok: (n) => `ok:${n}`,
                err: () => "err",
            }),
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

    test("match instrada sul ramo ok", () => {
        const r = ok<number, string>(2);
        assert.equal(
            r.match({ ok: (d) => `ok:${d}`, err: (e) => `err:${e}` }),
            "ok:2",
        );
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
                .match({
                    ok: () => "ok",
                    err: (e) => e,
                }),
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
            err<string>("e").match({
                ok: () => "ok",
                err: (e) => `err:${e}`,
            }),
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

    test("match instrada sul ramo err", () => {
        const r = err<string, number>("boom");
        assert.equal(
            r.match({ ok: (d) => `ok:${d}`, err: (e) => `err:${e}` }),
            "err:boom",
        );
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

describe("combinators", () => {
    test("all raccoglie tutti i successi in tupla", () => {
        const r = all([ok(1), ok("due"), ok(true)] as const);
        assert.ok(r.isSuccess());
        assert.deepEqual(r.data, [1, "due", true]);
    });

    test("all ritorna il primo errore in ordine di iterazione", () => {
        const r = all([ok(1), err("primo"), err("secondo")]);
        assert.ok(r.isFailure());
        assert.equal(r.error, "primo");
    });

    test("all su lista vuota e un successo con tupla vuota", () => {
        const r = all([]);
        assert.ok(r.isSuccess());
        assert.deepEqual(r.data, []);
    });

    test("partition non corto-circuita e preserva l'ordine", () => {
        const [oks, errs] = partition([
            ok<number, string>(1),
            err<string, number>("a"),
            ok<number, string>(2),
            err<string, number>("b"),
        ]);
        assert.deepEqual(oks, [1, 2]);
        assert.deepEqual(errs, ["a", "b"]);
    });

    test("flatten appiattisce un Result annidato", () => {
        assert.equal(flatten(ok(ok(5))).unwrapOr(0), 5);
        assert.equal(flatten(ok(err<string, number>("dentro"))).unwrapOr(0), 0);
        assert.equal(
            flatten(err<string, Result<number, string>>("fuori")).unwrapOr(0),
            0,
        );
    });
});

describe("tapBoth e guard statici", () => {
    test("tapBoth osserva il ramo giusto e restituisce il Result", () => {
        const visti: string[] = [];
        const r = ok<number, string>(1).tapBoth({
            ok: (d) => visti.push(`ok:${d}`),
            err: (e) => visti.push(`err:${e}`),
        });
        assert.deepEqual(visti, ["ok:1"]);
        assert.ok(r.isSuccess());

        const r2 = err<string, number>("x").tapBoth({
            err: (e) => visti.push(`err:${e}`),
        });
        assert.deepEqual(visti, ["ok:1", "err:x"]);
        assert.ok(r2.isFailure());
    });

    test("i guard statici filtrano una lista", () => {
        const list = [
            ok<number, string>(1),
            err<string, number>("a"),
            ok<number, string>(2),
        ];
        assert.equal(list.filter(isOk).length, 2);
        assert.equal(list.filter(isErr).length, 1);
    });
});

describe("fromSchema", () => {
    test("fromSchema restituisce ok sull'input valido", () => {
        const schema = z.object({ nome: z.string() });
        const r = fromSchema(schema, { nome: "ada" });
        assert.ok(r.isSuccess());
        assert.deepEqual(r.data, { nome: "ada" });
    });

    test("fromSchema restituisce gli issue sull'input invalido", () => {
        const schema = z.object({ nome: z.string() });
        const r = fromSchema(schema, { nome: 42 });
        assert.ok(r.isFailure());
        assert.ok(Array.isArray(r.error));
        assert.ok(r.error.length > 0);
        assert.equal(typeof r.error[0].message, "string");
    });

    test("fromSchema lancia se la validazione e asincrona", () => {
        const asyncSchema = {
            "~standard": {
                version: 1 as const,
                vendor: "test",
                validate: () => Promise.resolve({ value: 1 }),
            },
        };
        assert.throws(() => fromSchema(asyncSchema, 1), TypeError);
    });

    test("fromSchema lancia anche su un thenable non nativo (cross-realm)", () => {
        // Deliberatamente fuori dal tipo dichiarato: e' il caso che
        // `fromSchema` deve sopravvivere a runtime — un thenable non nativo
        // che `instanceof Promise` non riconoscerebbe. Il cast vive qui, al
        // punto di costruzione dello schema, non nell'asserzione:
        // `assert.throws` sotto continua a provare esattamente cio' che deve
        // provare.
        const foreignThenableSchema = {
            "~standard": {
                version: 1 as const,
                vendor: "test",
                validate: () => ({
                    // biome-ignore lint/suspicious/noThenProperty: il test verifica proprio il rilevamento di un thenable non nativo.
                    then(resolve: (value: { value: number }) => void) {
                        resolve({ value: 1 });
                    },
                }),
            },
        } as unknown as StandardSchemaV1<number, number>;
        assert.throws(() => fromSchema(foreignThenableSchema, 1), TypeError);
    });
});
