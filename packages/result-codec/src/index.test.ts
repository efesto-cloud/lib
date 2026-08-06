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

const DateSchema = z.object({
    id: z.string(),
    creatoIl: z.date().transform((d) => d.toISOString()),
});

const DateCodec = codec({
    serialize: { ok: DateSchema, err: ErrSchema },
    deserialize: { ok: DateSchema, err: ErrSchema },
});

test("serialize usa il valore validato dello schema, non il dato di dominio, sul ramo ok", () => {
    const creatoIl = new Date("2024-01-01T00:00:00.000Z");
    const out = DateCodec.serialize(Result.ok({ id: "1", creatoIl }));
    assert.ok(out.isSuccess());
    if (!out.isSuccess()) return;
    assert.ok(out.data.success);
    if (!out.data.success) return;
    // Se l'implementazione usasse `result.data` invece di `checked.value`,
    // qui arriverebbe l'istanza `Date` di dominio, non la stringa ISO
    // prodotta dallo schema di serializzazione.
    assert.equal(out.data.data.creatoIl, "2024-01-01T00:00:00.000Z");
    assert.equal(typeof out.data.data.creatoIl, "string");
    // Verifica statica: il campo sul filo ha il tipo di OUTPUT dello schema
    // (string), non quello di dominio (Date) — questa riga non
    // compilerebbe se il tipo dichiarato del busta non seguisse Out<SOk>.
    const wireCreatoIl: string = out.data.data.creatoIl;
    void wireCreatoIl;
});

class ItemExpired extends TaggedError("ItemExpired")<{ scadutoIl: Date }> {}

const ItemExpiredWireSchema = z.object({
    _tag: z.literal("ItemExpired"),
    scadutoIl: z.date().transform((d) => d.toISOString()),
});

const ExpiryCodec = codec({
    serialize: { ok: UserSchema, err: ItemExpiredWireSchema },
    deserialize: { ok: UserSchema, err: ItemExpiredWireSchema },
});

test("serialize usa il valore validato dello schema, non l'istanza di dominio, sul ramo err", () => {
    const scadutoIl = new Date("2024-06-15T12:00:00.000Z");
    const out = ExpiryCodec.serialize(
        Result.err(new ItemExpired({ scadutoIl })),
    );
    assert.ok(out.isSuccess());
    if (!out.isSuccess()) return;
    assert.equal(out.data.success, false);
    if (out.data.success) return;
    // Se l'implementazione usasse `result.error` invece di `checked.value`,
    // qui arriverebbe l'istanza `ItemExpired` con la `Date` di dominio, non
    // la stringa ISO prodotta dallo schema di serializzazione dell'errore.
    assert.equal(out.data.error.scadutoIl, "2024-06-15T12:00:00.000Z");
    assert.equal(typeof out.data.error.scadutoIl, "string");
    // Verifica statica: stesso ragionamento del ramo ok, ma su Out<SErr>.
    const wireScadutoIl: string = out.data.error.scadutoIl;
    void wireScadutoIl;
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

test("deserialize ricostruisce il ramo ok", () => {
    const wire = JSON.parse(
        JSON.stringify(
            UserCodec.serializeUnsafe(Result.ok({ id: "1", nome: "ada" })),
        ),
    );
    const out = UserCodec.deserialize(wire);
    assert.ok(out.isSuccess());
    assert.deepEqual(out.data, { id: "1", nome: "ada" });
});

test("deserialize ricostruisce l'ISTANZA d'errore, non un oggetto piatto", () => {
    const wire = JSON.parse(
        JSON.stringify(
            UserCodec.serializeUnsafe(Result.err(new FooNotFound())),
        ),
    );
    const out = UserCodec.deserialize(wire);
    assert.ok(out.isFailure());
    assert.ok(out.error instanceof FooNotFound);
});

test("una busta malformata da DecodeError con branch envelope", () => {
    for (const bad of [null, 42, "x", [], {}, { success: "forse" }]) {
        const out = UserCodec.deserialize(bad);
        assert.ok(
            out.isFailure(),
            `atteso fallimento per ${JSON.stringify(bad)}`,
        );
        assert.ok(DecodeError.is(out.error));
        assert.equal(out.error.branch, "envelope");
    }
});

test("un payload che non rispetta lo schema da DecodeError con branch ok", () => {
    const out = UserCodec.deserialize({ success: true, data: { id: 1 } });
    assert.ok(out.isFailure());
    assert.ok(DecodeError.is(out.error));
    assert.equal(out.error.branch, "ok");
    assert.ok(out.error.issues.length > 0);
});

test("un tag d'errore sconosciuto da DecodeError con branch err", () => {
    const out = UserCodec.deserialize({
        success: false,
        error: { _tag: "MaiSentito" },
    });
    assert.ok(out.isFailure());
    assert.ok(DecodeError.is(out.error));
    assert.equal(out.error.branch, "err");
});

test("l'errore di dominio e quello di trasporto si distinguono per tag", () => {
    const dominio = UserCodec.deserialize({
        success: false,
        error: { _tag: "FooNotFound" },
    });
    assert.ok(dominio.isFailure());
    assert.ok(FooNotFound.is(dominio.error));
    assert.ok(!DecodeError.is(dominio.error));

    const trasporto = UserCodec.deserialize({ success: "forse" });
    assert.ok(trasporto.isFailure());
    assert.ok(DecodeError.is(trasporto.error));
});

test("deserializeUnsafe lancia sul payload rotto ma non sull'errore di dominio", () => {
    assert.throws(
        () => UserCodec.deserializeUnsafe({ success: "forse" }),
        (e: unknown) => e instanceof DecodeError,
    );
    const dominio = UserCodec.deserializeUnsafe({
        success: false,
        error: { _tag: "FooNotFound" },
    });
    assert.ok(dominio.isFailure());
    assert.ok(dominio.error instanceof FooNotFound);
});
