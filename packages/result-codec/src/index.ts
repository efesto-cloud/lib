import Result, { err, type IResult, ok } from "@efesto-cloud/result";
import { TaggedError } from "@efesto-cloud/tagged-error";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export class EncodeError extends TaggedError("EncodeError")<{
    issues: readonly StandardSchemaV1.Issue[];
    branch: "ok" | "err";
}> {}

export class DecodeError extends TaggedError("DecodeError")<{
    issues: readonly StandardSchemaV1.Issue[];
    branch: "envelope" | "ok" | "err";
}> {}

// ---------------------------------------------------------------------------
// `validateSync` — un codec e sincrono per costruzione: lo schema deve
// rispondere senza attraversare il microtask queue, perche il client
// deserializza durante il render.
//
// Il riconoscimento del ramo asincrono e strutturale (un `then` chiamabile),
// non `instanceof Promise`: `instanceof Promise` fallisce sui thenable non
// nativi e sulle Promise cross-realm (node:vm, worker, iframe), lasciando
// cadere quel valore nel ramo sincrono e producendo un successo il cui tipo
// mente. Stessa forma di `_isThenable` in `@efesto-cloud/result`.
// ---------------------------------------------------------------------------

type In<S extends StandardSchemaV1> = StandardSchemaV1.InferInput<S>;
type Out<S extends StandardSchemaV1> = StandardSchemaV1.InferOutput<S>;

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
    typeof (value as { then?: unknown } | null | undefined)?.then ===
    "function";

const validateSync = <S extends StandardSchemaV1>(
    schema: S,
    value: unknown,
): StandardSchemaV1.Result<Out<S>> => {
    const out = schema["~standard"].validate(value);
    if (isThenable(out)) {
        throw new TypeError(
            "result-codec richiede validatori sincroni: il client deserializza durante il render",
        );
    }
    return out as StandardSchemaV1.Result<Out<S>>;
};

export interface CodecSchemas<
    SOk extends StandardSchemaV1,
    SErr extends StandardSchemaV1,
    DOk extends StandardSchemaV1,
    DErr extends StandardSchemaV1,
> {
    serialize: { ok: SOk; err: SErr };
    deserialize: { ok: DOk; err: DErr };
}

export interface ResultCodec<
    SOk extends StandardSchemaV1,
    SErr extends StandardSchemaV1,
    DOk extends StandardSchemaV1,
    DErr extends StandardSchemaV1,
> {
    serialize(
        result: Result<In<SOk>, In<SErr>>,
    ): Result<IResult<Out<SOk>, Out<SErr>>, EncodeError>;
    serializeUnsafe(
        result: Result<In<SOk>, In<SErr>>,
    ): IResult<Out<SOk>, Out<SErr>>;
    deserialize(input: unknown): Result<Out<DOk>, Out<DErr> | DecodeError>;
    deserializeUnsafe(input: unknown): Result<Out<DOk>, Out<DErr>>;
}

export function codec<
    SOk extends StandardSchemaV1,
    SErr extends StandardSchemaV1,
    DOk extends StandardSchemaV1,
    DErr extends StandardSchemaV1,
>(
    schemas: CodecSchemas<SOk, SErr, DOk, DErr>,
): ResultCodec<SOk, SErr, DOk, DErr> {
    const serialize = (
        result: Result<In<SOk>, In<SErr>>,
    ): Result<IResult<Out<SOk>, Out<SErr>>, EncodeError> => {
        if (result.isSuccess()) {
            const checked = validateSync(schemas.serialize.ok, result.data);
            if (checked.issues) {
                return err(
                    new EncodeError({ issues: checked.issues, branch: "ok" }),
                );
            }
            return ok({ success: true, data: checked.value, error: undefined });
        }
        const checked = validateSync(schemas.serialize.err, result.error);
        if (checked.issues) {
            return err(
                new EncodeError({ issues: checked.issues, branch: "err" }),
            );
        }
        return ok({ success: false, data: undefined, error: checked.value });
    };

    const decodeErr = (
        issues: readonly StandardSchemaV1.Issue[],
        branch: "envelope" | "ok" | "err",
    ) => err(new DecodeError({ issues, branch }));

    const deserialize = (
        input: unknown,
    ): Result<Out<DOk>, Out<DErr> | DecodeError> => {
        if (
            typeof input !== "object" ||
            input === null ||
            Array.isArray(input)
        ) {
            return decodeErr([{ message: "Expected an object" }], "envelope");
        }
        const envelope = input as {
            success?: unknown;
            data?: unknown;
            error?: unknown;
        };
        if (typeof envelope.success !== "boolean") {
            return decodeErr(
                [{ message: "Missing boolean `success`", path: ["success"] }],
                "envelope",
            );
        }

        if (envelope.success) {
            const checked = validateSync(schemas.deserialize.ok, envelope.data);
            return checked.issues
                ? decodeErr(checked.issues, "ok")
                : ok(checked.value);
        }

        const checked = validateSync(schemas.deserialize.err, envelope.error);
        return checked.issues
            ? decodeErr(checked.issues, "err")
            : err(checked.value);
    };

    return {
        serialize,
        serializeUnsafe: (result) => serialize(result).unwrapOrThrow(),
        deserialize,
        deserializeUnsafe: (input) => {
            const r = deserialize(input);
            if (r.isFailure() && DecodeError.is(r.error)) throw r.error;
            return r as Result<Out<DOk>, Out<DErr>>;
        },
    };
}
