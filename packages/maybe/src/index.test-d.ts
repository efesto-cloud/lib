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

// match() requires both handlers.
const _m: string = a.match({ some: (v) => `n:${v}`, none: () => "vuoto" });

// @ts-expect-error - handler `none` mancante
const _bad = a.match({ some: (v) => v });

void _t;
void _r;
void _m;
void _bad;
