// Type-level tests for Result<T, E>. Validated by `tsc` via tsconfig.test.json;
// never executed (the `.test-d.ts` extension is excluded from the test runner).

import type Result from "./index.js";
import type { err, Failure, Success } from "./index.js";
import { all, flatten, isErr, isOk, ok, partition } from "./index.js";

type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false;
type Expect<T extends true> = T;

interface User {
    id: string;
}
class NotFound {
    readonly _tag = "NotFound";
}

declare const r: Result<User, NotFound>;

// isSuccess() narrows to the data branch and forbids `.error`.
if (r.isSuccess()) {
    type _DataIsUser = Expect<Equal<typeof r.data, User>>;
    // @ts-expect-error — `.error` is `undefined` on Success, not NotFound.
    const _bad: NotFound = r.error;
} else {
    type _ErrorIsNotFound = Expect<Equal<typeof r.error, NotFound>>;
}

// Factory inference: ok() widens E to the requested type, err() widens T.
type _OkInfersError = Expect<
    Equal<ReturnType<typeof ok<User, NotFound>>, Result<User, NotFound>>
>;
type _ErrInfersData = Expect<
    Equal<ReturnType<typeof err<NotFound, User>>, Result<User, NotFound>>
>;

// ok() with no argument resolves to Result<void, never> via its zero-arg overload.
const _okVoid = ok();
type _OkVoidIsVoid = Expect<Equal<typeof _okVoid, Result<void, never>>>;

// Supplying T explicitly while omitting the value is rejected: the zero-arg
// overload takes no type arguments and the value overload requires the value.
// @ts-expect-error
const _okExplicit = ok<User>();

// map() preserves the error type; flatMap() unions error types.
declare const mapped: ReturnType<typeof r.map<number>>;
type _MapKeepsError = Expect<Equal<typeof mapped, Result<number, NotFound>>>;

class Other {
    readonly _tag = "Other";
}
declare const chained: ReturnType<typeof r.flatMap<number, Other>>;
type _FlatMapUnionsErrors = Expect<
    Equal<typeof chained, Result<number, NotFound | Other>>
>;

// match() takes a single { ok, err } handlers object.
// NOTE: named `rMatch` (not `r`) to avoid redeclaring the module-level `r`
// above; type is `Result<number, string>` per the task brief verbatim.
declare const rMatch: Result<number, string>;

const _a: string = rMatch.match({ ok: (d) => `n:${d}`, err: (e) => e });
const _b: string | number = rMatch.match({ ok: (d) => d, err: (e) => e });

// @ts-expect-error - handler `err` mancante
const _c = rMatch.match({ ok: (d) => d });

void _a;
void _b;
void _c;

// all() / partition() / flatten() — collection combinators.

declare const n: Result<number, "boom">;
declare const s: Result<string, "bang">;
declare const bl: Result<boolean, never>;

const _tuple = all([n, s, bl]);
if (_tuple.isSuccess()) {
    const _t: [number, string, boolean] = _tuple.data;
    void _t;
} else {
    const _e: "boom" | "bang" = _tuple.error;
    void _e;
}

declare const list: Result<number, "boom">[];
const _arr = all(list);
if (_arr.isSuccess()) {
    const _a2: number[] = _arr.data;
    void _a2;
}

const [_oks, _errs]: [number[], "boom"[]] = partition(list);

declare const nested: Result<Result<number, "dentro">, "fuori">;
const _flat: Result<number, "dentro" | "fuori"> = flatten(nested);

void _tuple;
void _arr;
void _oks;
void _errs;
void _flat;

// isOk() / isErr() — static guards, passed point-free to Array.prototype.filter().
//
// This is a known TS trap: a generic type guard passed by reference (not as an
// inline arrow) to a generic higher-order function like `filter` does not
// always get its type parameters inferred from the array's element type —
// sometimes the result silently degrades to the input type (no narrowing) or
// to `unknown[]`. Verified here (TS 6.0.2, strict mode, NodeNext): with the
// `isOk`/`isErr` signatures as specified in the brief, `Array.prototype.filter`'s
// `filter<S extends T>(predicate: (value: T, ...) => value is S): S[]` overload
// DOES infer `S` correctly from the array's element type in this codebase's
// configuration, narrowing to `Success<...>[]` / `Failure<...>[]` — not
// `Result<...>[]` and not `unknown[]`. If this ever regresses (e.g. after a
// tsconfig or TS version change), it will surface here as a type error.
declare const guardList: Result<number, string>[];

const _oksFiltered = guardList.filter(isOk);
type _OksFilteredIsSuccessArray = Expect<
    Equal<typeof _oksFiltered, Success<number, string>[]>
>;

const _errsFiltered = guardList.filter(isErr);
type _ErrsFilteredIsFailureArray = Expect<
    Equal<typeof _errsFiltered, Failure<number, string>[]>
>;

void _oksFiltered;
void _errsFiltered;
