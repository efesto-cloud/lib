import { err, ok, type Result } from "@efesto-cloud/result";

// ---------------------------------------------------------------------------
// ResultAsync<T, E> — companion to Result<T, E> for asynchronous workflows.
//
// Wraps a `Promise<Result<T, E>>` and exposes the same fluent surface as
// `Result`. The wrapped promise is contractually expected NEVER to reject —
// all error paths are captured as `Failure`. Always go through `fromPromise`,
// `fromSafePromise`, or `fromThrowable` when bridging from existing
// promise-returning code that may reject.
//
// Implements `PromiseLike<Result<T, E>>` so you can `await` a ResultAsync
// directly and receive the underlying `Result<T, E>`.
// ---------------------------------------------------------------------------

export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
    constructor(private readonly _promise: Promise<Result<T, E>>) {}

    // biome-ignore lint/suspicious/noThenProperty: intentional — implements PromiseLike so `await ra` resolves to Result<T, E>.
    then<TResult1 = Result<T, E>, TResult2 = never>(
        onFulfilled?:
            | ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
            | null,
        onRejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
    ): PromiseLike<TResult1 | TResult2> {
        return this._promise.then(onFulfilled, onRejected);
    }

    map<R>(fn: (data: T) => R | Promise<R>): ResultAsync<R, E> {
        return new ResultAsync(
            this._promise.then(async (r) =>
                r.isSuccess() ? ok<R, E>(await fn(r.data)) : err<E, R>(r.error),
            ),
        );
    }

    mapError<F>(fn: (e: E) => F | Promise<F>): ResultAsync<T, F> {
        return new ResultAsync(
            this._promise.then(async (r) =>
                r.isSuccess() ? ok<T, F>(r.data) : err<F, T>(await fn(r.error)),
            ),
        );
    }

    flatMap<R, F>(
        fn: (
            data: T,
        ) => Result<R, F> | ResultAsync<R, F> | Promise<Result<R, F>>,
    ): ResultAsync<R, E | F> {
        return new ResultAsync(
            this._promise.then(async (r) => {
                if (r.isFailure()) return err<E | F, R>(r.error);
                const next = await fn(r.data);
                return next as Result<R, E | F>;
            }),
        );
    }

    andThen<R, F>(
        fn: (
            data: T,
        ) => Result<R, F> | ResultAsync<R, F> | Promise<Result<R, F>>,
    ): ResultAsync<R, E | F> {
        return this.flatMap(fn);
    }

    orElse<F>(
        fn: (e: E) => Result<T, F> | ResultAsync<T, F> | Promise<Result<T, F>>,
    ): ResultAsync<T, F> {
        return new ResultAsync(
            this._promise.then(async (r) => {
                if (r.isSuccess()) return ok<T, F>(r.data);
                const next = await fn(r.error);
                return next as Result<T, F>;
            }),
        );
    }

    match<A, B = A>(
        onOk: (data: T) => A | Promise<A>,
        onErr: (e: E) => B | Promise<B>,
    ): Promise<A | B> {
        return this._promise.then((r) =>
            r.isSuccess() ? onOk(r.data) : onErr(r.error),
        );
    }

    tap(fn: (data: T) => void | Promise<void>): ResultAsync<T, E> {
        return new ResultAsync(
            this._promise.then(async (r) => {
                if (r.isSuccess()) await fn(r.data);
                return r;
            }),
        );
    }

    tapError(fn: (e: E) => void | Promise<void>): ResultAsync<T, E> {
        return new ResultAsync(
            this._promise.then(async (r) => {
                if (r.isFailure()) await fn(r.error);
                return r;
            }),
        );
    }

    unwrapOr<U>(fallback: U): Promise<T | U> {
        return this._promise.then((r) => r.unwrapOr(fallback));
    }

    unwrapOrThrow(): Promise<T> {
        return this._promise.then((r) => r.unwrapOrThrow());
    }

    // ------- static factories --------------------------------------------

    static fromPromise<T, E>(
        promise: PromiseLike<T>,
        errorMapper: (caught: unknown) => E,
    ): ResultAsync<T, E> {
        return new ResultAsync<T, E>(
            Promise.resolve(promise).then(
                (value) => ok<T, E>(value),
                (caught: unknown) => err<E, T>(errorMapper(caught)),
            ),
        );
    }

    static fromSafePromise<T, E = never>(
        promise: PromiseLike<T>,
    ): ResultAsync<T, E> {
        return new ResultAsync<T, E>(
            Promise.resolve(promise).then((v) => ok<T, E>(v)),
        );
    }

    static fromThrowable<Args extends unknown[], T, E>(
        fn: (...args: Args) => Promise<T> | T,
        errorMapper: (caught: unknown) => E,
    ): (...args: Args) => ResultAsync<T, E> {
        return (...args) => {
            try {
                return ResultAsync.fromPromise(
                    Promise.resolve(fn(...args)),
                    errorMapper,
                );
            } catch (caught) {
                return errAsync<E, T>(errorMapper(caught));
            }
        };
    }
}

// ---------------------------------------------------------------------------
// Module-level factories.
// ---------------------------------------------------------------------------

export function okAsync<T, E = never>(value: T): ResultAsync<T, E> {
    return new ResultAsync<T, E>(Promise.resolve(ok<T, E>(value)));
}

export function errAsync<E, T = never>(error: E): ResultAsync<T, E> {
    return new ResultAsync<T, E>(Promise.resolve(err<E, T>(error)));
}

export const fromPromise = ResultAsync.fromPromise;
export const fromSafePromise = ResultAsync.fromSafePromise;
export const fromThrowable = ResultAsync.fromThrowable;

export default ResultAsync;
