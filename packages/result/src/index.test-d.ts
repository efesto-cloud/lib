// Type-level tests for Result<T, E>. Validated by `tsc` via tsconfig.test.json;
// never executed (the `.test-d.ts` extension is excluded from the test runner).

import type { err, ok, Result } from "./index.js";

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
