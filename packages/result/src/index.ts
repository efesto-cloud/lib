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
    match<A, B = A>(handlers: { ok: (data: T) => A; err: (e: E) => B }): A | B {
        return handlers.ok(this.data);
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
    /** @deprecated Usa `match({ ok, err })`. `fold` ha gli argomenti in ordine inverso. */
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
    match<A, B = A>(handlers: { ok: (data: T) => A; err: (e: E) => B }): A | B {
        return handlers.err(this.error);
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
    /** @deprecated Usa `match({ ok, err })`. `fold` ha gli argomenti in ordine inverso. */
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
// Type helpers for collection combinators.
// `OkOf`/`ErrOf` are distributive conditional types over `R`: since `Result`
// is the union `Success | Failure`, both branches must be spelled out
// explicitly, or inference fails on the non-matching member.
// ---------------------------------------------------------------------------

export type OkOf<R> =
    R extends Success<infer T, infer _E>
        ? T
        : R extends Failure<infer T, infer _E>
          ? T
          : never;

export type ErrOf<R> =
    R extends Success<infer _T, infer E>
        ? E
        : R extends Failure<infer _T, infer E>
          ? E
          : never;

type OkTuple<T extends readonly unknown[]> = { [K in keyof T]: OkOf<T[K]> };
type ErrUnion<T extends readonly unknown[]> = {
    [K in keyof T]: ErrOf<T[K]>;
}[number];

// ---------------------------------------------------------------------------
// Single-source factory implementations. Both module-level exports and the
// `Result` namespace alias these so there's only one implementation.
// ---------------------------------------------------------------------------

interface OkFn {
    (): Result<void, never>;
    <T, E = never>(value: T): Result<T, E>;
}
const _ok = (<T, E = never>(value?: T): Result<T, E> =>
    new Success<T, E>(value as T)) as OkFn;
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
// Collection combinators.
// ---------------------------------------------------------------------------

const _all = <T extends readonly Result<unknown, unknown>[]>(
    results: readonly [...T],
): Result<OkTuple<T>, ErrUnion<T>> => {
    const values: unknown[] = [];
    for (const r of results) {
        if (r.isFailure()) return _err(r.error as ErrUnion<T>);
        values.push(r.data);
    }
    return _ok(values as OkTuple<T>);
};

const _partition = <T, E>(results: readonly Result<T, E>[]): [T[], E[]] => {
    const oks: T[] = [];
    const errs: E[] = [];
    for (const r of results) {
        if (r.isSuccess()) oks.push(r.data);
        else errs.push(r.error);
    }
    return [oks, errs];
};

const _flatten = <T, E, F>(
    nested: Result<Result<T, E>, F>,
): Result<T, E | F> =>
    nested.isFailure() ? _err<E | F, T>(nested.error) : nested.data;

// ---------------------------------------------------------------------------
// Module-level factories (neverthrow-style).
// ---------------------------------------------------------------------------

export const ok = _ok;
export const err = _err;
export const fromThrowable = _fromThrowable;
export const fromObject = _fromObject;
export const fromZod = _fromZod;
export const all = _all;
export const partition = _partition;
export const flatten = _flatten;

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
    export const all = _all;
    export const partition = _partition;
    export const flatten = _flatten;
}

export default Result;
