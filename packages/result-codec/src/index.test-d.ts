import Result from "@efesto-cloud/result";
import {
    matchError,
    TaggedError,
    taggedErrorSchema,
} from "@efesto-cloud/tagged-error";
import { z } from "zod";
import { codec, DecodeError } from "./index.js";

class FooNotFound extends TaggedError("FooNotFound") {}
class FooForbidden extends TaggedError("FooForbidden")<{ motivo: string }> {}

const UserSchema = z.object({ id: z.string(), nome: z.string() });
const ErrSchema = taggedErrorSchema(FooNotFound, FooForbidden);
const c = codec({
    serialize: { ok: UserSchema, err: ErrSchema },
    deserialize: { ok: UserSchema, err: ErrSchema },
});

declare const input: unknown;
const decoded = c.deserialize(input);

if (decoded.isFailure()) {
    // l'esaustività deve coprire dominio E trasporto, e sopravvivere al round trip
    const _status: number = matchError(decoded.error, {
        FooNotFound: () => 404,
        FooForbidden: (e) => e.motivo.length,
        DecodeError: (e) => e.issues.length,
    });
    void _status;

    // @ts-expect-error - manca l'handler per DecodeError
    const _incomplete = matchError(decoded.error, {
        FooNotFound: () => 404,
        FooForbidden: () => 403,
    });
    void _incomplete;
}

if (decoded.isSuccess()) {
    const _user: { id: string; nome: string } = decoded.data;
    void _user;
}

// deserializeUnsafe toglie DecodeError dall'unione
const unsafe = c.deserializeUnsafe(input);
if (unsafe.isFailure()) {
    const _onlyDomain: FooNotFound | FooForbidden = unsafe.error;
    void _onlyDomain;
}

void c;
void DecodeError;
void Result;
