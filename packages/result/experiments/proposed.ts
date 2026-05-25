// PROPOSED implementation — neverthrow-style.
//
// Key design choices vs the current implementation:
//   1. Both classes share the SAME generic order: Success<T, E>, Failure<T, E>.
//      Even though Failure never stores a T at runtime, carrying it as a
//      phantom keeps the union homogeneous.
//   2. Factory functions `ok` / `err` return Result<T, E> (the union), NOT the
//      concrete subclass. This is what fixes INFERENCE: the inferred return
//      type of a function whose body returns ok(...)/err(...) is the union of
//      Result<T, E> instantiations, not the union of concrete subclasses.
//   3. No `T = never` / `E = never` defaults.
//   4. All methods share identical signatures across both classes, so calling
//      them on the union (Result<T, E>) is well-typed.
//   5. .map's signature does not introduce an unbindable `E2` — it returns
//      Result<R, E> directly. Same for mapErr returning Result<T, F>.

export class Success<T, E> {
    readonly success = true as const;
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
}

export class Failure<T, E> {
    readonly success = false as const;
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
}

export type Result<T, E> = Success<T, E> | Failure<T, E>;

// The KEY trick: factories return the UNION type, not the concrete class.
// Contextual typing from a function's declared return type binds the phantom.
// In an inferred-return context, the union still ends up being
//   Result<T, E1> | Result<T, E2> | ...  ==  Result<T, E1 | E2 | ...>
// (Up to the way TS collapses unions of generic instantiations — see test.)
export function ok<T, E = never>(value: T): Result<T, E> {
    return new Success<T, E>(value);
}
export function err<E, T = never>(error: E): Result<T, E> {
    return new Failure<T, E>(error);
}

// Wrap a function that may throw into one returning Result.
// The caught value is `unknown` (TS4+ catch behavior); the mapper produces E.
export function fromThrowable<Args extends unknown[], T, E>(
    fn: (...args: Args) => T,
    errorMapper: (caught: unknown) => E,
): (...args: Args) => Result<T, E> {
    return (...args) => {
        try {
            return ok(fn(...args));
        } catch (caught) {
            return err(errorMapper(caught));
        }
    };
}
