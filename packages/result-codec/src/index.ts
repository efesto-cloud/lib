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

/**
 * Il `TypeError` deliberato del ramo thenable, con un'identita' riconoscibile.
 *
 * Resta un `TypeError` (quindi `assert.throws(..., TypeError)` continua a
 * valere), ma il `catch` difensivo di `deserialize` puo' rilanciarlo
 * SELETTIVAMENTE invece di dipendere dalla posizione fisica del `try`: e' un
 * errore di programmazione da correggere, non una condizione di dato da
 * mascherare. Privata al modulo: non fa parte dell'API pubblica.
 */
class SyncValidatorRequiredError extends TypeError {}

const describeThrown = (caught: unknown): string => {
    try {
        return caught instanceof Error ? caught.message : String(caught);
    } catch {
        return "errore non descrivibile";
    }
};

const validateSync = <S extends StandardSchemaV1>(
    schema: S,
    value: unknown,
): StandardSchemaV1.Result<Out<S>> => {
    // Uno schema puo' lanciare in modo sincrono (un `transform`/`refine` non
    // difensivo di un validatore non-zod, o uno schema che legge le proprieta'
    // dell'input a mano su un payload ostile), oppure restituire un risultato
    // ostile il cui `then` lancia in lettura. Il throw diventa un issue: un
    // DecodeError/EncodeError, non un'eccezione che attraversa il render. Il
    // `try` copre percio' anche il test sul thenable, non la sola chiamata a
    // `validate` — altrimenti `serialize` resterebbe scoperta, non avendo il
    // blocco difensivo esterno di `deserialize`.
    try {
        const out = schema["~standard"].validate(value) as
            | StandardSchemaV1.Result<Out<S>>
            | PromiseLike<unknown>;
        if (isThenable(out)) {
            // Zod converte QUALSIASI throw dello schema in una Promise (il
            // fallback `safeParseAsync` nel suo `~standard.validate`): quella
            // Promise puo' essere gia' rifiutata e, senza handler, la
            // unhandled rejection porta giu' il processo Node. In un loader
            // non e' un 500, e' il server che cade. La neutralizziamo prima
            // di lanciare.
            Promise.resolve(out).catch(() => {});
            throw new SyncValidatorRequiredError(
                "result-codec richiede validatori sincroni (il client deserializza durante il render): lo schema ha restituito un thenable. Con zod questo accade sia quando la validazione e' davvero asincrona, sia quando uno schema sincrono ha lanciato — zod converte il throw in una Promise, e i due casi sono indistinguibili a valle: controlla anche i transform/refine sincroni.",
            );
        }
        return out;
    } catch (caught) {
        if (caught instanceof SyncValidatorRequiredError) throw caught;
        return {
            issues: [
                {
                    message: `Lo schema ha lanciato durante la validazione: ${describeThrown(caught)}`,
                },
            ],
        };
    }
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
        // `deserialize` non deve MAI lanciare su input malformato: l'intera
        // decodifica sta dentro il `try`. `input` e tipizzato `unknown` e
        // arriva dal filo, quindi ogni operazione su di esso e ostile —
        // `Array.isArray` su un Proxy revocato lancia, i getter e i trap
        // `get` lanciano, uno schema che legge le proprieta a mano lancia.
        //
        // La protezione NON si regge sulla posizione fisica del `try`: il
        // `TypeError` deliberato del ramo thenable ha un'identita propria
        // (`SyncValidatorRequiredError`) e viene rilanciato selettivamente
        // dal `catch`.
        //
        // `branch` traccia dove eravamo, cosi il DecodeError riporta il ramo
        // effettivo e non un generico "envelope".
        let branch: "envelope" | "ok" | "err" = "envelope";
        try {
            if (
                typeof input !== "object" ||
                input === null ||
                Array.isArray(input)
            ) {
                return decodeErr(
                    [{ message: "Expected an object" }],
                    "envelope",
                );
            }

            const envelope = input as {
                success?: unknown;
                data?: unknown;
                error?: unknown;
            };
            const success = envelope.success;
            const data = envelope.data;
            const errorField = envelope.error;

            if (typeof success !== "boolean") {
                return decodeErr(
                    [
                        {
                            message: "Missing boolean `success`",
                            path: ["success"],
                        },
                    ],
                    "envelope",
                );
            }

            if (success) {
                branch = "ok";
                const checked = validateSync(schemas.deserialize.ok, data);
                return checked.issues
                    ? decodeErr(checked.issues, "ok")
                    : ok(checked.value);
            }

            branch = "err";
            const checked = validateSync(schemas.deserialize.err, errorField);
            return checked.issues
                ? decodeErr(checked.issues, "err")
                : err(checked.value);
        } catch (caught) {
            if (caught instanceof SyncValidatorRequiredError) throw caught;
            return decodeErr(
                [
                    {
                        message: `La decodifica ha lanciato: ${describeThrown(caught)}`,
                    },
                ],
                branch,
            );
        }
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
