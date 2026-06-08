import type Maybe from "@efesto-cloud/maybe";
import { maybe, none, some } from "@efesto-cloud/maybe";

// ---------------------------------------------------------------------------
// MaybeAsync<T> — companion to Maybe<T> for asynchronous workflows.
//
// Wraps a `Promise<Maybe<T>>` and exposes the same fluent surface as `Maybe`.
// The wrapped promise is contractually expected NEVER to reject — an absent
// value is captured as `None`. Bridge from rejecting promise-returning code
// with `fromPromise` or `fromThrowable`, both of which collapse a rejection to
// `None`.
//
// Implements `PromiseLike<Maybe<T>>` so you can `await` a MaybeAsync directly
// and receive the underlying `Maybe<T>`.
// ---------------------------------------------------------------------------

class MaybeAsync<T extends NonNullable<unknown>>
    implements PromiseLike<Maybe<T>>
{
    constructor(private readonly _promise: Promise<Maybe<T>>) {}

    // biome-ignore lint/suspicious/noThenProperty: intentional — implements PromiseLike so `await ma` resolves to Maybe<T>.
    then<TResult1 = Maybe<T>, TResult2 = never>(
        onFulfilled?:
            | ((value: Maybe<T>) => TResult1 | PromiseLike<TResult1>)
            | null,
        onRejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
    ): PromiseLike<TResult1 | TResult2> {
        return this._promise.then(onFulfilled, onRejected);
    }

    map<R extends NonNullable<unknown>>(
        fn: (value: T) => R | Promise<R>,
    ): MaybeAsync<R> {
        return new MaybeAsync(
            this._promise.then(async (m) =>
                m.isSome() ? some<R>(await fn(m.data)) : none<R>(),
            ),
        );
    }

    flatMap<R extends NonNullable<unknown>>(
        fn: (value: T) => Maybe<R> | MaybeAsync<R> | Promise<Maybe<R>>,
    ): MaybeAsync<R> {
        return new MaybeAsync(
            this._promise.then(async (m) => {
                if (m.isNone()) return none<R>();
                const next = await fn(m.data);
                return next as Maybe<R>;
            }),
        );
    }

    andThen<R extends NonNullable<unknown>>(
        fn: (value: T) => Maybe<R> | MaybeAsync<R> | Promise<Maybe<R>>,
    ): MaybeAsync<R> {
        return this.flatMap(fn);
    }

    filter(predicate: (value: T) => boolean | Promise<boolean>): MaybeAsync<T> {
        return new MaybeAsync(
            this._promise.then(async (m) =>
                m.isSome() && (await predicate(m.data)) ? m : none<T>(),
            ),
        );
    }

    orElse(
        fn: () => Maybe<T> | MaybeAsync<T> | Promise<Maybe<T>>,
    ): MaybeAsync<T> {
        return new MaybeAsync(
            this._promise.then(async (m) => {
                if (m.isSome()) return m;
                const next = await fn();
                return next as Maybe<T>;
            }),
        );
    }

    match<A, B = A>(
        onSome: (value: T) => A | Promise<A>,
        onNone: () => B | Promise<B>,
    ): Promise<A | B> {
        return this._promise.then((m) =>
            m.isSome() ? onSome(m.data) : onNone(),
        );
    }

    tap(fn: (value: T) => void | Promise<void>): MaybeAsync<T> {
        return new MaybeAsync(
            this._promise.then(async (m) => {
                if (m.isSome()) await fn(m.data);
                return m;
            }),
        );
    }

    tapNone(fn: () => void | Promise<void>): MaybeAsync<T> {
        return new MaybeAsync(
            this._promise.then(async (m) => {
                if (m.isNone()) await fn();
                return m;
            }),
        );
    }

    unwrapOr<U>(fallback: U): Promise<T | U> {
        return this._promise.then((m) => m.unwrapOr(fallback));
    }

    unwrapOrThrow(): Promise<T> {
        return this._promise.then((m) => m.unwrapOrThrow());
    }

    // ------- static factories --------------------------------------------

    static fromPromise<T extends NonNullable<unknown>>(
        promise: PromiseLike<T | null | undefined>,
    ): MaybeAsync<T> {
        return new MaybeAsync<T>(
            Promise.resolve(promise).then(
                (value) => maybe<T>(value),
                () => none<T>(),
            ),
        );
    }

    static fromSafePromise<T extends NonNullable<unknown>>(
        promise: PromiseLike<T | null | undefined>,
    ): MaybeAsync<T> {
        return new MaybeAsync<T>(
            Promise.resolve(promise).then((value) => maybe<T>(value)),
        );
    }

    static fromThrowable<
        Args extends unknown[],
        T extends NonNullable<unknown>,
    >(
        fn: (
            ...args: Args
        ) => Promise<T | null | undefined> | T | null | undefined,
    ): (...args: Args) => MaybeAsync<T> {
        return (...args) => {
            try {
                return MaybeAsync.fromPromise<T>(Promise.resolve(fn(...args)));
            } catch {
                return noneAsync<T>();
            }
        };
    }
}

// ---------------------------------------------------------------------------
// Module-level factories.
// ---------------------------------------------------------------------------

export function someAsync<T extends NonNullable<unknown>>(
    value: T,
): MaybeAsync<T> {
    return new MaybeAsync<T>(Promise.resolve(some<T>(value)));
}

export function noneAsync<
    T extends NonNullable<unknown> = never,
>(): MaybeAsync<T> {
    return new MaybeAsync<T>(Promise.resolve(none<T>()));
}

export function maybeAsync<T extends NonNullable<unknown>>(
    value?: T | null,
): MaybeAsync<T> {
    return new MaybeAsync<T>(Promise.resolve(maybe<T>(value)));
}

export const fromPromise = MaybeAsync.fromPromise;
export const fromSafePromise = MaybeAsync.fromSafePromise;
export const fromThrowable = MaybeAsync.fromThrowable;

export default MaybeAsync;
