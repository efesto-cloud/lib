import type { ZodError, ZodSafeParseResult } from "zod";

// ---------------------------------------------------------------------------
// Plain-object shapes — preserved for backwards compatibility.
// `IResult<T, E>` keeps the historical generic order on the union members.
// ---------------------------------------------------------------------------

export interface ISuccess<T, E = never> {
    success: true;
    data: T;
    error?: E;
}

export interface IFailure<E, T = never> {
    success: false;
    data?: T;
    error: E;
}

export type IResult<T, E> = ISuccess<T, E> | IFailure<E, T>;

// ---------------------------------------------------------------------------
// Success / Failure classes.
//
// Both classes carry the SAME generic order <T, E> — the phantom slot keeps
// the union homogeneous and enables symmetric narrowing / signature unification
// on Result<T, E>.
//
// NOTE: this changes the generic order of `Failure` (was `Failure<E, T>`).
// `Failure<E>` at use sites must be rewritten to `Failure<unknown, E>` (or
// the appropriate T). This is the one unavoidable breaking change.
// ---------------------------------------------------------------------------

export class Success<T, E = never> {
    readonly success = true as const;
    readonly error = undefined;

    constructor(readonly data: T) {}

    isSuccess(): this is Success<T, E> {
        return true;
    }
    isFailure(): this is Failure<T, E> {
        return false;
    }

    map<R>(fn: (data: T) => R): Result<R, E> {
        return ok(fn(this.data));
    }
    mapError<F>(_: (e: E) => F): Result<T, F> {
        return ok(this.data);
    }
    flatMap<R, F>(fn: (data: T) => Result<R, F>): Result<R, E | F> {
        return fn(this.data);
    }
    andThen<R, F>(fn: (data: T) => Result<R, F>): Result<R, E | F> {
        return this.flatMap(fn);
    }
    orElse<F>(_: (e: E) => Result<T, F>): Result<T, F> {
        return ok(this.data);
    }
    match<A, B = A>(onOk: (data: T) => A, _onErr: (e: E) => B): A | B {
        return onOk(this.data);
    }
    tap(fn: (data: T) => void): Result<T, E> {
        fn(this.data);
        return this;
    }
    tapError(_: (e: E) => void): Result<T, E> {
        return this;
    }
    unwrapOr<U>(_: U): T | U {
        return this.data;
    }
    unwrapOrThrow(): T {
        return this.data;
    }

    // -- compat aliases (pre-existing API) ----------------------------------
    fold<A, B = A>(_onErr: (e: E) => A, onOk: (data: T) => B): A | B {
        return onOk(this.data);
    }
    else(): Result<T, E> {
        return this;
    }
    run(fn: (data: T) => void): void {
        fn(this.data);
    }
    toObject(): ISuccess<T> {
        return {
            success: true,
            data: this.data,
            error: undefined,
        };
    }
}

export class Failure<T = never, E = unknown> {
    readonly success = false as const;
    readonly data = undefined;

    constructor(readonly error: E) {}

    isSuccess(): this is Success<T, E> {
        return false;
    }
    isFailure(): this is Failure<T, E> {
        return true;
    }

    map<R>(_: (data: T) => R): Result<R, E> {
        return err(this.error);
    }
    mapError<F>(fn: (e: E) => F): Result<T, F> {
        return err(fn(this.error));
    }
    flatMap<R, F>(_: (data: T) => Result<R, F>): Result<R, E | F> {
        return err(this.error);
    }
    andThen<R, F>(fn: (data: T) => Result<R, F>): Result<R, E | F> {
        return this.flatMap(fn);
    }
    orElse<F>(fn: (e: E) => Result<T, F>): Result<T, F> {
        return fn(this.error);
    }
    match<A, B = A>(_onOk: (data: T) => A, onErr: (e: E) => B): A | B {
        return onErr(this.error);
    }
    tap(_: (data: T) => void): Result<T, E> {
        return this;
    }
    tapError(fn: (e: E) => void): Result<T, E> {
        fn(this.error);
        return this;
    }
    unwrapOr<U>(fallback: U): T | U {
        return fallback;
    }
    unwrapOrThrow(): never {
        throw this.error;
    }

    // -- compat aliases (pre-existing API) ----------------------------------
    fold<A, B = A>(onErr: (e: E) => A, _onOk: (data: T) => B): A | B {
        return onErr(this.error);
    }
    else(value: () => T): Result<T, E> {
        return ok(value());
    }
    run(): void {
        return;
    }
    toObject(): IFailure<E> {
        return {
            success: false,
            data: undefined,
            error: this.error,
        };
    }
}

type Result<T, E> = Success<T, E> | Failure<T, E>;

// ---------------------------------------------------------------------------
// Single-source factory implementations. Both module-level exports and the
// `Result` namespace alias these so there's only one implementation.
// ---------------------------------------------------------------------------

const _ok = <T, E = never>(value: T): Result<T, E> => new Success<T, E>(value);
const _err = <E, T = never>(error: E): Result<T, E> => new Failure<T, E>(error);
const _fromThrowable = <Args extends unknown[], T, E>(
    fn: (...args: Args) => T,
    errorMapper: (caught: unknown) => E,
): ((...args: Args) => Result<T, E>) => {
    return (...args) => {
        try {
            return _ok(fn(...args));
        } catch (caught) {
            return _err(errorMapper(caught));
        }
    };
};
const _fromObject = <T, E>(obj: IResult<T, E>): Result<T, E> =>
    obj.success ? new Success<T, E>(obj.data) : new Failure<T, E>(obj.error);
const _fromZod = <Output>(
    res: ZodSafeParseResult<Output>,
): Result<Output, ZodError<Output>> =>
    res.success ? _ok(res.data) : _err(res.error);

// ---------------------------------------------------------------------------
// Module-level factories (neverthrow-style).
// ---------------------------------------------------------------------------

export const ok = _ok;
export const err = _err;
export const fromThrowable = _fromThrowable;
export const fromObject = _fromObject;
export const fromZod = _fromZod;

// ---------------------------------------------------------------------------
// `Result` namespace — declaration-merged with the `Result<T, E>` type so
// existing `Result.ok(...)`, `Result.err(...)`, `Result.fromObject(...)`,
// `Result.fromZod(...)` and `import Result from "..."` keep working.
// ---------------------------------------------------------------------------

namespace Result {
    export const ok = _ok;
    export const err = _err;
    export const fromThrowable = _fromThrowable;
    export const fromObject = _fromObject;
    export const fromZod = _fromZod;
}

export default Result;
