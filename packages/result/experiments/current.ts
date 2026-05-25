// ASSESSMENT — current implementation
//
// Scenario:
//
//   declare a function returning Result<User, NotFoundError | ValidationError>
//   and inside the body return concrete Success(...) and Failure(...) values.
//
// Result of the experiment: assignability to a *declared* return type DOES
// work today (the structural compatibility is loose enough). The real
// failure mode is INFERENCE — without a declared return type, TS infers a
// union of concrete subclasses with `never` phantoms, not Result<T, E>.

import Result, { Failure, Success } from "../src/index.js";
import type { Bidirectional, Equal, Expect } from "./assert.js";

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

// -----------------------------------------------------------------------------
// CASE A: declared return type, returns built via the `new` constructors.
// -----------------------------------------------------------------------------
// VERDICT: compiles. Structural assignability is fine here.
export function fetchUser_constructors_declared(
    id: string,
): Result<User, FetchErr> {
    if (!id) return new Failure(new ValidationError("id"));
    if (id === "missing") return new Failure(new NotFoundError(id));
    return new Success({ id, name: "Alice" });
}

// -----------------------------------------------------------------------------
// CASE B: same body, using the Result.ok / Result.err factories.
// -----------------------------------------------------------------------------
// VERDICT: compiles.
export function fetchUser_factories_declared(
    id: string,
): Result<User, FetchErr> {
    if (!id) return Result.err(new ValidationError("id"));
    if (id === "missing") return Result.err(new NotFoundError(id));
    return Result.ok({ id, name: "Alice" });
}

// -----------------------------------------------------------------------------
// CASE C: NO declared return type — what does TS infer?
// -----------------------------------------------------------------------------
// THIS IS THE FAILURE MODE THE USER IS HITTING.
//
// Desired:  Result<User, NotFoundError | ValidationError>
// Actual:   Failure<ValidationError, never> | Failure<NotFoundError, never>
//           | Success<{ id: string; name: string }, never>
//
// Consequence: the inferred type can't be passed where a Result<T, E> is
// expected unless explicitly widened/cast.
function fetchUser_inferred(id: string) {
    if (!id) return new Failure(new ValidationError("id"));
    if (id === "missing") return new Failure(new NotFoundError(id));
    return new Success({ id, name: "Alice" });
}

type Inferred = ReturnType<typeof fetchUser_inferred>;
type Desired = Result<User, FetchErr>;

// FAILS — inferred type is NOT structurally Result<User, FetchErr>.
// @ts-expect-error documents the gap.
type _InferenceProducesResult = Expect<Equal<Inferred, Desired>>;

// Even the WEAKER bidirectional-assignability check fails for the current
// implementation, because the inferred type uses
// Failure<E, never> while Result uses Failure<E, T>.
// @ts-expect-error
type _InferenceBidirectional = Expect<Bidirectional<Inferred, Desired>>;

// What we ACTUALLY get: union of concrete classes with `never` phantoms.
type _Actual = Expect<
    Equal<
        Inferred,
        | Failure<ValidationError, never>
        | Failure<NotFoundError, never>
        | Success<{ id: string; name: string }, never>
    >
>;

// And practically: you cannot pass the inferred value to a function expecting
// Result<User, FetchErr> without an explicit cast/annotation upstream.
declare function consume(r: Result<User, FetchErr>): void;
// This DOES work because Success/Failure structurally match the union — but
// note that the error union (FetchErr) is widened *by the consumer*, not
// preserved from the producer. If `consume` expected
// Result<User, NotFoundError> alone, the call would (incorrectly) still pass
// for the Success branch and fail in non-obvious ways for the Failure
// branches.
consume(fetchUser_inferred("x"));

// -----------------------------------------------------------------------------
// CASE E: the same scenario with the factories — same inference problem.
// -----------------------------------------------------------------------------
function fetchUser_inferred_factories(id: string) {
    if (!id) return Result.err(new ValidationError("id"));
    if (id === "missing") return Result.err(new NotFoundError(id));
    return Result.ok({ id, name: "Alice" });
}

type InferredFactories = ReturnType<typeof fetchUser_inferred_factories>;

// @ts-expect-error — factories don't fix inference either.
type _FactoriesInferResult = Expect<Equal<InferredFactories, Desired>>;

// -----------------------------------------------------------------------------
// CASE F: chained .map / .flatMap on a Result<T, E> loses the error union.
// -----------------------------------------------------------------------------
declare const r1: Result<number, NotFoundError>;
const r2 = r1.map((n) => n + 1);
const r3 = r1.flatMap((n): Result<string, ValidationError> =>
    n > 0 ? Result.ok(String(n)) : Result.err(new ValidationError("n")),
);

// We expect: Result<number, NotFoundError>
// (E2 was never bound at the call site because it doesn't appear in args.)
// Whatever TS infers here is shaped by the .map signature returning
// Result<R, E | E2>. Capture it:
type R2 = typeof r2;
type R3 = typeof r3;

// .map does NOT preserve E — declared return is Result<R, E|E2> but the
// concrete Success/Failure construct narrows E2 to never and the union widens
// wrong.
// @ts-expect-error
type _MapPreservesE = Expect<Equal<R2, Result<number, NotFoundError>>>;

// .flatMap DOES merge E correctly because E2 is inferrable from the callback
// return type, so E | E2 actually carries both.
type _FlatMapMergesE = Expect<
    Equal<R3, Result<string, NotFoundError | ValidationError>>
>;
