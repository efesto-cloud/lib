// Type-level tests for Maybe<T>. Validated by `tsc` via tsconfig.test.json;
// never executed (the `.test-d.ts` extension is excluded from the test runner).

import type Result from "@efesto-cloud/result";
import type Maybe from "./index.js";
import type { maybe, NoneError, some } from "./index.js";
import { all } from "./index.js";

type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false;
type Expect<T extends true> = T;

declare const m: Maybe<number>;

// isSome() narrows to the data branch.
if (m.isSome()) {
    type _DataIsNumber = Expect<Equal<typeof m.data, number>>;
} else {
    type _IsNone = Expect<Equal<typeof m.some, false>>;
}

// maybe() lifts a nullable into Maybe of the non-null type.
type _MaybeStripsNull = Expect<
    Equal<ReturnType<typeof maybe<string>>, Maybe<string>>
>;

// map() carries the mapped type through.
declare const mapped: ReturnType<typeof m.map<string>>;
type _MapType = Expect<Equal<typeof mapped, Maybe<string>>>;

// toResult() bridges into Result with a NoneError failure channel by default.
declare const someInstance: ReturnType<typeof some<number>>;
const _resultDefault = someInstance.toResult();
type _ToResult = Expect<
    Equal<typeof _resultDefault, Result<number, NoneError>>
>;
void _resultDefault;

// toResult() keeps the `NoneError` constituent in its error channel even
// when `E` is explicitly instantiated to something else. Regression test:
// if `Some.toResult` dropped `| NoneError` from its declared return type
// (e.g. `Result<T, E>` instead of `Result<T, E | NoneError>`), calling with
// the default `E = NoneError` above wouldn't notice — the union collapses
// to `NoneError` either way. Instantiating with an unrelated `OtherError`
// keeps the union from collapsing, so a dropped constituent becomes visible.
class OtherError extends Error {}

const _resultOtherOnSome = someInstance.toResult<OtherError>();
type _ToResultKeepsNoneErrorOnSome = Expect<
    Equal<typeof _resultOtherOnSome, Result<number, OtherError | NoneError>>
>;
void _resultOtherOnSome;

// all() collects into a typed tuple.
declare const a: Maybe<number>;
declare const b: Maybe<string>;

const _t = all([a, b]);
if (_t.isSome()) {
    const _tt: [number, string] = _t.data;
    void _tt;
}

// toResult() accepts a custom error factory.
class MioErrore extends Error {}
const _r: Result<number, MioErrore | NoneError> = a.toResult(
    () => new MioErrore(),
);

// Same regression as above, on the generic `Maybe<T>` union (not just the
// concrete `Some<T>` branch): `NoneError` must survive in the error channel
// of both members when `E` is instantiated to an unrelated type.
const _resultOtherOnMaybe = a.toResult<OtherError>();
type _ToResultKeepsNoneErrorOnMaybe = Expect<
    Equal<typeof _resultOtherOnMaybe, Result<number, OtherError | NoneError>>
>;
void _resultOtherOnMaybe;

// match() requires both handlers.
const _m: string = a.match({ some: (v) => `n:${v}`, none: () => "vuoto" });

// @ts-expect-error - handler `none` mancante
const _bad = a.match({ some: (v) => v });

void _t;
void _r;
void _m;
void _bad;
