import assert from "node:assert/strict";
import { test } from "node:test";
import Result from "@efesto-cloud/result";
import { TaggedError, taggedErrorSchema } from "@efesto-cloud/tagged-error";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod";
import { codec, DecodeError, EncodeError } from "./index.js";

test("gli errori del codec sono tagged error", () => {
    const e = new EncodeError({ issues: [], branch: "ok" });
    assert.equal(e._tag, "EncodeError");
    assert.ok(e instanceof Error);
    const d = new DecodeError({ issues: [], branch: "envelope" });
    assert.equal(d._tag, "DecodeError");
    assert.equal(d.branch, "envelope");
});

class FooNotFound extends TaggedError("FooNotFound") {}

const UserSchema = z.object({ id: z.string(), nome: z.string() });
const ErrSchema = taggedErrorSchema(FooNotFound);

const UserCodec = codec({
    serialize: { ok: UserSchema, err: ErrSchema },
    deserialize: { ok: UserSchema, err: ErrSchema },
});

test("serialize produce la busta piatta sul ramo ok", () => {
    const out = UserCodec.serialize(Result.ok({ id: "1", nome: "ada" }));
    assert.ok(out.isSuccess());
    assert.equal(out.data.success, true);
    assert.deepEqual(out.data.data, { id: "1", nome: "ada" });
});

test("serialize produce la busta piatta sul ramo err", () => {
    const out = UserCodec.serialize(Result.err(new FooNotFound()));
    assert.ok(out.isSuccess());
    assert.equal(out.data.success, false);
    assert.equal((out.data.error as FooNotFound)._tag, "FooNotFound");
});

test("serialize fallisce con EncodeError se il dato non rispetta lo schema", () => {
    const out = UserCodec.serialize(Result.ok({ id: 1, nome: "ada" } as never));
    assert.ok(out.isFailure());
    assert.equal(out.error._tag, "EncodeError");
    assert.equal(out.error.branch, "ok");
    assert.ok(out.error.issues.length > 0);
});

test("serializeUnsafe lancia invece di restituire un Failure", () => {
    assert.doesNotThrow(() =>
        UserCodec.serializeUnsafe(Result.ok({ id: "1", nome: "ada" })),
    );
    assert.throws(
        () => UserCodec.serializeUnsafe(Result.ok({ id: 1 } as never)),
        (e: unknown) => e instanceof EncodeError,
    );
});

test("la busta serializzata sopravvive a JSON.stringify", () => {
    const wire = JSON.parse(
        JSON.stringify(
            UserCodec.serializeUnsafe(Result.err(new FooNotFound())),
        ),
    );
    assert.equal(wire.success, false);
    assert.equal(wire.error._tag, "FooNotFound");
});

test("uno schema asincrono lancia un TypeError", () => {
    const asyncSchema = {
        "~standard": {
            version: 1 as const,
            vendor: "test",
            validate: () => Promise.resolve({ value: 1 }),
        },
    };
    const c = codec({
        serialize: { ok: asyncSchema, err: ErrSchema },
        deserialize: { ok: asyncSchema, err: ErrSchema },
    });
    assert.throws(() => c.serialize(Result.ok(1)), TypeError);
});

test("uno schema che restituisce un thenable non nativo lancia comunque un TypeError", () => {
    // Deliberatamente fuori dal tipo dichiarato: e' il caso che il codec deve
    // sopravvivere a runtime — un thenable non nativo che `instanceof Promise`
    // non riconoscerebbe. Il cast vive qui, al punto di costruzione dello
    // schema, non nell'asserzione: `assert.throws` sotto continua a provare
    // esattamente cio' che deve provare.
    const thenableSchema = {
        "~standard": {
            version: 1 as const,
            vendor: "test",
            validate: () => ({
                // biome-ignore lint/suspicious/noThenProperty: il test verifica proprio il rilevamento di un thenable non nativo.
                then(
                    resolve: (result: StandardSchemaV1.Result<number>) => void,
                ) {
                    resolve({ value: 1 });
                },
            }),
        },
    } as unknown as StandardSchemaV1<number, number>;
    const c = codec({
        serialize: { ok: thenableSchema, err: ErrSchema },
        deserialize: { ok: thenableSchema, err: ErrSchema },
    });
    assert.throws(() => c.serialize(Result.ok(1)), TypeError);
});
