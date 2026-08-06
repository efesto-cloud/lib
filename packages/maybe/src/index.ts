import Result from "@efesto-cloud/result";

// ---------------------------------------------------------------------------
// Plain-object shapes — preserved for backwards compatibility.
// ---------------------------------------------------------------------------

export type ISome<T extends NonNullable<unknown>> = {
    some: true;
    data: T;
};

export type INone = {
    some: false;
    data: null;
};

export type IMaybe<T extends NonNullable<unknown>> = ISome<T> | INone;

export class NoneError extends Error {
    constructor() {
        super("NoneError");
    }
}

// ---------------------------------------------------------------------------
// Some / None classes.
//
// Both carry the same generic <T> — `None<T = never>` keeps the union
// homogeneous and enables symmetric narrowing on `Maybe<T>`.
// ---------------------------------------------------------------------------

export class Some<T extends NonNullable<unknown>> implements ISome<T> {
    readonly some = true as const;

    constructor(readonly data: T) {}

    isSome(): this is Some<T> {
        return true;
    }

    isNone(): this is None<T> {
        return false;
    }

    map<R extends NonNullable<unknown>>(fn: (value: T) => R): Maybe<R> {
        return new Some<R>(fn(this.data));
    }

    flatMap<R extends NonNullable<unknown>>(
        fn: (value: T) => Maybe<R>,
    ): Maybe<R> {
        return fn(this.data);
    }

    andThen<R extends NonNullable<unknown>>(
        fn: (value: T) => Maybe<R>,
    ): Maybe<R> {
        return this.flatMap(fn);
    }

    filter(predicate: (value: T) => boolean): Maybe<T> {
        return predicate(this.data) ? new Some(this.data) : new None();
    }

    match<A, B = A>(handlers: { some: (value: T) => A; none: () => B }): A | B {
        return handlers.some(this.data);
    }

    tap(fn: (value: T) => void): Maybe<T> {
        fn(this.data);
        return this;
    }

    tapNone(_: () => void): Maybe<T> {
        return this;
    }

    or(_: Maybe<T>): Maybe<T> {
        return this;
    }

    unwrapOr<U>(_: U): T | U {
        return this.data;
    }

    unwrapOrThrow(): T {
        return this.data;
    }

    // -- compat aliases (pre-existing API) ----------------------------------
    run(fn: (value: T) => void): void {
        fn(this.data);
    }

    /** @deprecated Usa `match({ some, none })`. */
    fold<R1, R2>(_: () => R1, onSome: (value: T) => R2): R1 | R2 {
        return onSome(this.data);
    }

    else(): Maybe<T> {
        return this;
    }

    toObject(): ISome<T> {
        return {
            some: true,
            data: this.data,
        };
    }

    toResult<E = NoneError>(_?: () => E): Result<T, E | NoneError> {
        return Result.ok(this.data);
    }
}

export class None<T extends NonNullable<unknown> = never> implements INone {
    readonly some = false as const;

    constructor(readonly data = null) {}

    isSome(): this is Some<T> {
        return false;
    }

    isNone(): this is None<T> {
        return true;
    }

    map<R extends NonNullable<unknown>>(_: (value: T) => R): Maybe<R> {
        return new None<R>();
    }

    flatMap<R extends NonNullable<unknown>>(_: (_: T) => Maybe<R>): Maybe<R> {
        return new None<R>();
    }

    andThen<R extends NonNullable<unknown>>(
        _: (value: T) => Maybe<R>,
    ): Maybe<R> {
        return new None<R>();
    }

    filter(): Maybe<T> {
        return new None();
    }

    match<A, B = A>(handlers: { some: (value: T) => A; none: () => B }): A | B {
        return handlers.none();
    }

    tap(_: (value: T) => void): Maybe<T> {
        return this;
    }

    tapNone(fn: () => void): Maybe<T> {
        fn();
        return this;
    }

    or(other: Maybe<T>): Maybe<T> {
        return other;
    }

    unwrapOr<U>(fallback: U): T | U {
        return fallback;
    }

    unwrapOrThrow(): never {
        throw new NoneError();
    }

    // -- compat aliases (pre-existing API) ----------------------------------
    run(): void {
        return;
    }

    /** @deprecated Usa `match({ some, none })`. */
    fold<R1, R2>(onNone: () => R1, _: (value: T) => R2): R1 | R2 {
        return onNone();
    }

    else(value: () => T): Maybe<T> {
        return new Some(value());
    }

    toObject(): INone {
        return {
            some: false,
            data: null,
        };
    }

    toResult<E = NoneError>(errorFactory?: () => E): Result<T, E | NoneError> {
        return Result.err(errorFactory ? errorFactory() : new NoneError());
    }
}

type Maybe<T extends NonNullable<unknown>> = Some<T> | None<T>;

// ---------------------------------------------------------------------------
// Single-source factory implementations. Both module-level exports and the
// `Maybe` namespace alias these so there's only one implementation.
// ---------------------------------------------------------------------------

const _some = <T extends NonNullable<unknown>>(value: T): Some<T> =>
    new Some<T>(value);
const _none = <T extends NonNullable<unknown> = never>(): None<T> =>
    new None<T>();
const _maybe = <T extends NonNullable<unknown>>(t?: T | null): Maybe<T> =>
    t !== null && t !== undefined ? new Some<T>(t) : new None<T>();
const _fromObject = <T extends NonNullable<unknown>>(
    obj: IMaybe<T>,
): Maybe<T> => (obj.some ? new Some(obj.data) : new None());
const _fromThrowable = <Args extends unknown[], T extends NonNullable<unknown>>(
    fn: (...args: Args) => T | null | undefined,
): ((...args: Args) => Maybe<T>) => {
    return (...args) => {
        try {
            return _maybe(fn(...args));
        } catch {
            return _none();
        }
    };
};
type SomeOf<M> =
    M extends Some<infer T> ? T : M extends None<infer T> ? T : never;

type SomeTuple<T extends readonly unknown[]> = {
    [K in keyof T]: SomeOf<T[K]>;
} & NonNullable<unknown>;

const _all = <T extends readonly Maybe<NonNullable<unknown>>[]>(
    maybes: readonly [...T],
): Maybe<SomeTuple<T>> => {
    const values: unknown[] = [];
    for (const m of maybes) {
        if (m.isNone()) return new None<SomeTuple<T>>();
        values.push(m.data);
    }
    return new Some<SomeTuple<T>>(values as SomeTuple<T>);
};

const _flatten = <T extends NonNullable<unknown>>(
    nested: Maybe<Maybe<T>>,
): Maybe<T> => (nested.isNone() ? new None<T>() : nested.data);

const _fromResult = <T extends NonNullable<unknown>>(
    r: Result<T, unknown>,
): Maybe<T> => (r.isSuccess() ? new Some<T>(r.data) : new None<T>());

// ---------------------------------------------------------------------------
// Module-level factories (neverthrow-style).
// ---------------------------------------------------------------------------

export const some = _some;
export const none = _none;
export const maybe = _maybe;
export const fromObject = _fromObject;
export const fromThrowable = _fromThrowable;
export const all = _all;
export const flatten = _flatten;
export const fromResult = _fromResult;

// ---------------------------------------------------------------------------
// `Maybe` namespace — declaration-merged with the `Maybe<T>` type so existing
// `Maybe.maybe(...)`, `Maybe.some(...)`, `Maybe.none(...)`, `Maybe.all(...)`
// and `import Maybe from "..."` keep working.
// ---------------------------------------------------------------------------

namespace Maybe {
    export const maybe = _maybe;
    export const some = _some;
    export const none = _none;
    export const fromObject = _fromObject;
    export const fromThrowable = _fromThrowable;
    export const all = _all;
    export const flatten = _flatten;
    export const fromResult = _fromResult;
}

export default Maybe;
