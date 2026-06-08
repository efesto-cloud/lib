// Verifica che i type-guard `isSuccess()` / `isFailure()` permettano l'accesso
// diretto a `.data` / `.error` con narrowing corretto, come nell'implementazione
// precedente.

import type { Equal, Expect } from "./assert.js";
import { err, ok, type Result } from "./proposed.js";

interface User {
    id: string;
    name: string;
}
class NotFoundError {
    readonly _tag = "NotFoundError";
    constructor(readonly id: string) {}
}
class ValidationError {
    readonly _tag = "ValidationError";
    constructor(readonly field: string) {}
}
type FetchErr = NotFoundError | ValidationError;

declare const r: Result<User, FetchErr>;

// -----------------------------------------------------------------------------
// CASE 1: narrowing via isSuccess()
// -----------------------------------------------------------------------------
if (r.isSuccess()) {
    // Dentro questo branch TS deve sapere che r è Success<User, FetchErr>.
    // Quindi r.data esiste ed è User.
    type _DataIsUser = Expect<Equal<typeof r.data, User>>;
    const name: string = r.data.name;
    void name;

    // E .error non deve essere accessibile come FetchErr (è absent qui).
    // Lo verifichiamo controllando che r non sia mai Failure in questo ramo.
    // @ts-expect-error — non c'è .error su Success.
    void r.error;
} else {
    // Nell'else r deve essere Failure<User, FetchErr>.
    type _ErrorIsFetchErr = Expect<Equal<typeof r.error, FetchErr>>;
    const tag: "NotFoundError" | "ValidationError" = r.error._tag;
    void tag;

    // @ts-expect-error — non c'è .data su Failure.
    void r.data;
}

// -----------------------------------------------------------------------------
// CASE 2: narrowing via isFailure()
// -----------------------------------------------------------------------------
if (r.isFailure()) {
    type _ErrorIsFetchErr2 = Expect<Equal<typeof r.error, FetchErr>>;
    void r.error._tag;

    // @ts-expect-error
    void r.data;
} else {
    type _DataIsUser2 = Expect<Equal<typeof r.data, User>>;
    void r.data.name;

    // @ts-expect-error
    void r.error;
}

// -----------------------------------------------------------------------------
// CASE 3: narrowing via discriminante `.success` (boolean letterale)
// -----------------------------------------------------------------------------
// Le classi proposte espongono `readonly success = true as const` / `false as
// const`, quindi anche il check diretto sul campo funziona come tagged union.
if (r.success) {
    type _DataIsUser3 = Expect<Equal<typeof r.data, User>>;
    void r.data.name;
} else {
    type _ErrorIsFetchErr3 = Expect<Equal<typeof r.error, FetchErr>>;
    void r.error._tag;
}

// -----------------------------------------------------------------------------
// CASE 4: narrowing su valori prodotti da ok()/err() (factory)
// -----------------------------------------------------------------------------
// Quando il valore arriva da una funzione con return inferito, il narrowing
// deve funzionare comunque.
function load(id: string) {
    if (!id) return err(new ValidationError("id"));
    return ok({ id, name: "Alice" } as User);
}

const v = load("x");
if (v.isSuccess()) {
    type _T = Expect<Equal<typeof v.data, User>>;
    void v.data.name;
} else {
    type _E = Expect<Equal<typeof v.error, ValidationError>>;
    void v.error.field;
}

// -----------------------------------------------------------------------------
// CASE 5: early-return idiomatico
// -----------------------------------------------------------------------------
function consume(r2: Result<User, FetchErr>): string {
    if (r2.isFailure()) {
        // r2 ristretto a Failure<User, FetchErr>
        return `err: ${r2.error._tag}`;
    }
    // qui r2 è Success<User, FetchErr>
    return r2.data.name;
}
void consume;
