// Tests for: fromThrowable, unwrapOr, tap/tapError, andThen alias.

import type { Equal, Expect } from "./assert.js";
import { type Result, err, fromThrowable, ok } from "./proposed.js";

declare const log: { info(...a: unknown[]): void; error(...a: unknown[]): void };

class ParseError {
    readonly _tag = "ParseError";
    constructor(readonly cause: unknown) {}
}
class NotFoundError {
    readonly _tag = "NotFoundError";
    constructor(readonly id: string) {}
}

// -----------------------------------------------------------------------------
// fromThrowable
// -----------------------------------------------------------------------------
const safeJsonParse = fromThrowable(
    JSON.parse as (text: string) => unknown,
    (caught) => new ParseError(caught),
);

// Signature: (text: string) => Result<unknown, ParseError>
type _ParseSig = Expect<
    Equal<typeof safeJsonParse, (text: string) => Result<unknown, ParseError>>
>;

const parsed = safeJsonParse('{"a":1}');
type _ParseRet = Expect<Equal<typeof parsed, Result<unknown, ParseError>>>;

// Multi-arg function — Args is inferred as the parameter tuple.
function div(a: number, b: number): number {
    if (b === 0) throw new Error("div by zero");
    return a / b;
}
const safeDiv = fromThrowable(div, (e) => (e instanceof Error ? e.message : "?"));
type _DivSig = Expect<
    Equal<typeof safeDiv, (a: number, b: number) => Result<number, string>>
>;

// -----------------------------------------------------------------------------
// unwrapOr
// -----------------------------------------------------------------------------
declare const r1: Result<number, NotFoundError>;

// Default of the same type → returns T
const n: number = r1.unwrapOr(0);
type _UnwrapOrSameType = Expect<Equal<typeof n, number>>;

// Default of a different type → returns T | U. Note: TS preserves the
// literal type of the fallback, so passing "missing" gives number | "missing"
// (not number | string). Bind to a typed variable first if you want widening.
const v = r1.unwrapOr("missing");
type _UnwrapOrLiteral = Expect<Equal<typeof v, number | "missing">>;

const fallbackStr: string = "missing";
const vWide = r1.unwrapOr(fallbackStr);
type _UnwrapOrWide = Expect<Equal<typeof vWide, number | string>>;

// On a known Ok, returns T (no narrowing required, but works either way)
const known = ok(42).unwrapOr(0);
type _UnwrapOrOk = Expect<Equal<typeof known, number>>;

// On a known Err, returns the fallback type
const fallback = err<NotFoundError, number>(new NotFoundError("x")).unwrapOr(0);
type _UnwrapOrErr = Expect<Equal<typeof fallback, number>>;

// -----------------------------------------------------------------------------
// tap / tapError (fluent side effects)
// -----------------------------------------------------------------------------
declare const r2: Result<number, NotFoundError>;

const logged = r2
    .tap((data) => {
        const _: number = data; // sees T
        void _;
    })
    .tapError((e) => {
        const _: string = e.id; // sees E
        void _;
    });

// tap/tapError must preserve the Result type exactly.
type _TapPreserves = Expect<Equal<typeof logged, Result<number, NotFoundError>>>;

// Composable in a chain — tap returns Result, so .map etc. still work.
const chained = r2
    .tap((n) => log.info("got", n))
    .map((n) => n + 1)
    .tapError((e) => log.error("oops", e._tag));
type _Chained = Expect<Equal<typeof chained, Result<number, NotFoundError>>>;

// Side effects only — don't accept return values, contract is void.
// (Returning a value from the callback is allowed but ignored.)

// -----------------------------------------------------------------------------
// andThen (alias of flatMap) — same type behavior
// -----------------------------------------------------------------------------
declare const r3: Result<number, NotFoundError>;

class ValidationError {
    readonly _tag = "ValidationError";
    constructor(readonly field: string) {}
}

const a1 = r3.andThen((n): Result<string, ValidationError> =>
    n > 0 ? ok(String(n)) : err(new ValidationError("n")),
);
type _AndThenMerges = Expect<
    Equal<typeof a1, Result<string, NotFoundError | ValidationError>>
>;

const a2 = r3.flatMap((n): Result<string, ValidationError> =>
    n > 0 ? ok(String(n)) : err(new ValidationError("n")),
);
// andThen and flatMap produce the same type.
type _AndThenSameAsFlatMap = Expect<Equal<typeof a1, typeof a2>>;

// -----------------------------------------------------------------------------
// Compound: realistic chain using all new utilities
// -----------------------------------------------------------------------------
declare function fetchRaw(id: string): Result<string, NotFoundError>;

function processUser(id: string) {
    return fetchRaw(id)
        .tap((raw) => log.info("raw length", raw.length))
        .andThen((raw) => safeJsonParse(raw))
        .tapError((e) => log.error(e))
        .map((parsed) => parsed as { name: string });
}

// Inferred composed result preserves both error types via andThen.
type Processed = ReturnType<typeof processUser>;
// Practical assignability check (bidirectional union shape may differ).
const _check: Result<{ name: string }, NotFoundError | ParseError> =
    processUser("x");
void _check;
