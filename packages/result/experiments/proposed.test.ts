// Same scenarios as `current.ts`, but against the proposed implementation.

import type { Bidirectional, Equal, Expect } from "./assert.js";
import { type Result, err, Failure, ok, Success } from "./proposed.js";

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
// CASE A: declared return type, returns via `new` constructors.
// -----------------------------------------------------------------------------
export function fetchUser_constructors_declared(
    id: string,
): Result<User, FetchErr> {
    if (!id) return new Failure(new ValidationError("id"));
    if (id === "missing") return new Failure(new NotFoundError(id));
    return new Success({ id, name: "Alice" });
}

// -----------------------------------------------------------------------------
// CASE B: declared return type, returns via ok/err factories.
// -----------------------------------------------------------------------------
export function fetchUser_factories_declared(
    id: string,
): Result<User, FetchErr> {
    if (!id) return err(new ValidationError("id"));
    if (id === "missing") return err(new NotFoundError(id));
    return ok({ id, name: "Alice" });
}

// -----------------------------------------------------------------------------
// CASE C: NO declared return type — what does TS infer?
// -----------------------------------------------------------------------------
// THIS IS THE CRITICAL CASE.
function fetchUser_inferred_factories(id: string) {
    if (!id) return err(new ValidationError("id"));
    if (id === "missing") return err(new NotFoundError(id));
    return ok({ id, name: "Alice" });
}

type InferredFactories = ReturnType<typeof fetchUser_inferred_factories>;
type Desired = Result<User, FetchErr>;

// What does TS infer?
// ok({id,name}) is Result<{id,name}, never>
// err(new ValidationError(...)) is Result<never, ValidationError>
// err(new NotFoundError(...)) is Result<never, NotFoundError>
//
// Union:
//   Result<User, never> | Result<never, ValidationError> | Result<never, NotFoundError>
//
// That is NOT structurally equal to Result<User, ValidationError | NotFoundError>
// because each instantiation has a different T. So plain inference STILL
// doesn't give us the merged type.
//
// However — and this is what we want to verify — this inferred type IS
// assignable to Result<User, FetchErr> when consumed.
declare function consume(r: Result<User, FetchErr>): void;
consume(fetchUser_inferred_factories("x")); // <-- compiles?

// And type equality with Desired?
// @ts-expect-error — Equal is strict; the inferred union is not literally
// Result<User, FetchErr>, it's a union of Result<User|never, never|FetchErr>.
type _InferenceEqualsDesired = Expect<Equal<InferredFactories, Desired>>;

// -----------------------------------------------------------------------------
// CASE C2: WITH an explicit type parameter on err — does TS infer better?
// -----------------------------------------------------------------------------
// If you tell err what T is supposed to be (or use a type parameter helper),
// the union collapses correctly.
function fetchUser_inferred_factories_widened(id: string) {
    if (!id) return err<FetchErr, User>(new ValidationError("id"));
    if (id === "missing") return err<FetchErr, User>(new NotFoundError(id));
    return ok<User, FetchErr>({ id, name: "Alice" });
}

type InferredWidened = ReturnType<typeof fetchUser_inferred_factories_widened>;

// This SHOULD equal Desired now:
type _WidenedEqualsDesired = Expect<Equal<InferredWidened, Desired>>;

// -----------------------------------------------------------------------------
// CASE F: .map preserves E and .flatMap merges E correctly.
// -----------------------------------------------------------------------------
declare const r1: Result<number, NotFoundError>;
const r2 = r1.map((n) => n + 1);
const r3 = r1.flatMap((n): Result<string, ValidationError> =>
    n > 0 ? ok(String(n)) : err(new ValidationError("n")),
);

type _MapPreservesE = Expect<Equal<typeof r2, Result<number, NotFoundError>>>;
type _FlatMapMergesE = Expect<
    Equal<typeof r3, Result<string, NotFoundError | ValidationError>>
>;

// -----------------------------------------------------------------------------
// CASE G: chained .map().mapError() etc keeps the union shape.
// -----------------------------------------------------------------------------
declare const r4: Result<number, NotFoundError>;
const r5 = r4.map((n) => n.toString()).mapError((e) => e.id);

type _ChainKeepsResult = Expect<Equal<typeof r5, Result<string, string>>>;

// -----------------------------------------------------------------------------
// CASE H: orElse can recover into a different error type.
// -----------------------------------------------------------------------------
declare const r6: Result<number, NotFoundError>;
const r7 = r6.orElse((_e) => ok(0));
type _OrElseRecovers = Expect<Equal<typeof r7, Result<number, never>>>;

const r8 = r6.orElse((_e) => err(new ValidationError("fallback")));
type _OrElseChangesE = Expect<Equal<typeof r8, Result<number, ValidationError>>>;

// -----------------------------------------------------------------------------
// CASE J: chaining on the INFERRED (un-annotated) result works.
// -----------------------------------------------------------------------------
// Even though the inferred type is technically
//   Result<User, never> | Result<never, FetchErr-piece1> | Result<never, FetchErr-piece2>
// methods on the union still behave as if it were Result<User, FetchErr>.
const inferred = fetchUser_inferred_factories("x");
const chained = inferred
    .map((u) => u.id)
    .mapError((e) => `err: ${(e as FetchErr)._tag}`);

// The narrowed-via-method chain produces Result<string, string> (with the
// type narrowed by user code). The key win: we can chain at all.
type _ChainedOnInferred = Expect<Equal<typeof chained, Result<string, string>>>;

// -----------------------------------------------------------------------------
// CASE K: composing two functions with inferred returns via flatMap.
// -----------------------------------------------------------------------------
function parseId(s: string) {
    if (s.length === 0) return err(new ValidationError("id"));
    return ok(s);
}
function loadUser(id: string) {
    if (id === "missing") return err(new NotFoundError(id));
    return ok({ id, name: "Alice" } as User);
}

function loadByRaw(raw: string) {
    return parseId(raw).flatMap((id) => loadUser(id));
}

// The composed function's inferred return is
//   Result<User, NotFoundError> | Result<User, NotFoundError | ValidationError>
// — not literally Result<User, FetchErr>, but BIDIRECTIONALLY ASSIGNABLE
// to it. That is the practical property: you can pass it where the union is
// expected, and you can receive the union where it is expected.
type Composed = ReturnType<typeof loadByRaw>;
type _Composed = Expect<Bidirectional<Composed, Result<User, FetchErr>>>;

// -----------------------------------------------------------------------------
// CASE I: match returns the unwrapped value.
// -----------------------------------------------------------------------------
declare const r9: Result<number, NotFoundError>;
const message = r9.match(
    (n) => `ok: ${n}`,
    (e) => `err: ${e.id}`,
);
type _MatchUnwraps = Expect<Equal<typeof message, string>>;
