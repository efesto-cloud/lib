// Type-level tests for Maybe<T>. Validated by `tsc` via tsconfig.test.json;
// never executed (the `.test-d.ts` extension is excluded from the test runner).

import type { Result } from "@efesto-cloud/result";
import type { Maybe, maybe, NoneError, some } from "./index.js";

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

// toResult() bridges into Result with a NoneError failure channel.
type _ToResult = Expect<
    Equal<
        ReturnType<typeof some<number>>["toResult"],
        () => Result<number, NoneError>
    >
>;
