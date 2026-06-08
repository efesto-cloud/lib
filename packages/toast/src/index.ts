import Maybe from "@efesto-cloud/maybe";
import type { IResult } from "@efesto-cloud/result";

// ---------------------------------------------------------------------------
// Plain-object shapes — preserved for backwards compatibility.
// `IToast<T, E>` keeps the historical generic order on the union members.
// ---------------------------------------------------------------------------

export interface IToastSuccess<T, E = never> {
    message: string;
    success: true;
    data: T;
    error?: E;
}

export interface IToastFailure<E, T = never> {
    message: string;
    success: false;
    data?: T;
    error: E;
}

export type IToast<T, E> = IToastSuccess<T, E> | IToastFailure<E, T>;

// ---------------------------------------------------------------------------
// ToastSuccess / ToastFailure classes.
//
// A `Toast` is a `Result` that also carries a human-facing `message`. Both
// classes carry the SAME generic order <T, E> — the phantom slot keeps the
// union homogeneous and enables symmetric narrowing on `Toast<T, E>`.
//
// NOTE: this changes the generic order of `ToastFailure` (was
// `ToastFailure<E, T>`). `ToastFailure<E>` at use sites must be rewritten to
// `ToastFailure<unknown, E>` (or the appropriate T).
// ---------------------------------------------------------------------------

export class ToastSuccess<T, E = never> implements IToastSuccess<T, E> {
    readonly success = true as const;
    readonly error = undefined;

    constructor(
        readonly message: string,
        readonly data: T,
    ) {}

    isSuccess(): this is ToastSuccess<T, E> {
        return true;
    }
    isFailure(): this is ToastFailure<T, E> {
        return false;
    }

    map<R>(fn: (data: T) => R): Toast<R, E> {
        return new ToastSuccess<R, E>(this.message, fn(this.data));
    }
    mapError<F>(_: (e: E) => F): Toast<T, F> {
        return new ToastSuccess<T, F>(this.message, this.data);
    }
    flatMap<R, F>(fn: (data: T) => Toast<R, F>): Toast<R, E | F> {
        return fn(this.data);
    }
    andThen<R, F>(fn: (data: T) => Toast<R, F>): Toast<R, E | F> {
        return this.flatMap(fn);
    }
    orElse<F>(_: (e: E) => Toast<T, F>): Toast<T, F> {
        return new ToastSuccess<T, F>(this.message, this.data);
    }
    match<A, B = A>(onOk: (data: T) => A, _onErr: (e: E) => B): A | B {
        return onOk(this.data);
    }
    tap(fn: (data: T) => void): Toast<T, E> {
        fn(this.data);
        return this;
    }
    tapError(_: (e: E) => void): Toast<T, E> {
        return this;
    }
    unwrapOr<U>(_: U): T | U {
        return this.data;
    }
    unwrapOrThrow(): T {
        return this.data;
    }

    // -- compat aliases (pre-existing API) ----------------------------------
    fold<R1, R2>(_: (error: E) => R1, onSuccess: (data: T) => R2): R1 | R2 {
        return onSuccess(this.data);
    }
    else(): Toast<T, E> {
        return this;
    }
    run(fn: (data: T) => void): void {
        fn(this.data);
    }
    toObject(): IToastSuccess<T> {
        return {
            success: true,
            message: this.message,
            data: this.data,
            error: undefined,
        };
    }

    toMaybe(): T extends NonNullable<unknown> ? Maybe<T> : Maybe<never> {
        return Maybe.some(
            this.data as NonNullable<unknown>,
        ) as T extends NonNullable<unknown> ? Maybe<T> : Maybe<never>;
    }
}

export class ToastFailure<T = never, E = unknown>
    implements IToastFailure<E, T>
{
    readonly success = false as const;
    readonly data = undefined;

    constructor(
        readonly message: string,
        readonly error: E,
    ) {}

    isSuccess(): this is ToastSuccess<T, E> {
        return false;
    }
    isFailure(): this is ToastFailure<T, E> {
        return true;
    }

    map<R>(_: (data: T) => R): Toast<R, E> {
        return new ToastFailure<R, E>(this.message, this.error);
    }
    mapError<F>(fn: (e: E) => F): Toast<T, F> {
        return new ToastFailure<T, F>(this.message, fn(this.error));
    }
    flatMap<R, F>(_: (data: T) => Toast<R, F>): Toast<R, E | F> {
        return new ToastFailure<R, E>(this.message, this.error);
    }
    andThen<R, F>(fn: (data: T) => Toast<R, F>): Toast<R, E | F> {
        return this.flatMap(fn);
    }
    orElse<F>(fn: (e: E) => Toast<T, F>): Toast<T, F> {
        return fn(this.error);
    }
    match<A, B = A>(_onOk: (data: T) => A, onErr: (e: E) => B): A | B {
        return onErr(this.error);
    }
    tap(_: (data: T) => void): Toast<T, E> {
        return this;
    }
    tapError(fn: (e: E) => void): Toast<T, E> {
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
    fold<R1, R2>(onFailure: (error: E) => R1, _: (data: T) => R2): R1 | R2 {
        return onFailure(this.error);
    }
    else(value: () => T): Toast<T, E> {
        return new ToastSuccess<T, E>(this.message, value());
    }
    run(): void {
        return;
    }
    toObject(): IToastFailure<E> {
        return {
            success: false,
            message: this.message,
            data: undefined,
            error: this.error,
        };
    }

    toMaybe(): T extends NonNullable<unknown> ? Maybe<T> : Maybe<never> {
        return Maybe.none() as T extends NonNullable<unknown>
            ? Maybe<T>
            : Maybe<never>;
    }
}

export type Toast<T, E> = ToastSuccess<T, E> | ToastFailure<T, E>;

// ---------------------------------------------------------------------------
// Single-source factory implementations. Both module-level exports and the
// `Toast` namespace alias these so there's only one implementation.
// ---------------------------------------------------------------------------

function _ok(message: string): ToastSuccess<void>;
function _ok<T>(message: string, v: T): ToastSuccess<T>;
function _ok<T = void>(message: string, v?: T): ToastSuccess<T> {
    return new ToastSuccess<T>(message, v as T);
}

function _err(message: string): ToastFailure<never, void>;
function _err<E>(message: string, v: E): ToastFailure<never, E>;
function _err<E = void>(message: string, v?: E): ToastFailure<never, E> {
    return new ToastFailure<never, E>(message, v as E);
}

function _fromObject<T, E>(obj: IToast<T, E>): Toast<T, E> {
    return obj.success
        ? new ToastSuccess<T, E>(obj.message, obj.data)
        : new ToastFailure<T, E>(obj.message, obj.error);
}

function _fromResult<T, E>(result: IResult<T, E>): Toast<T, E>;
function _fromResult<T, E>(
    result: IResult<T, E>,
    ok_message: string,
): Toast<T, E>;
function _fromResult<T, E>(
    result: IResult<T, E>,
    ok_message: string,
    err_message: string,
): Toast<T, E>;
function _fromResult<T, E>(
    result: IResult<T, E>,
    ok_message?: string,
    err_message?: string,
): Toast<T, E> {
    if (result.success) {
        return new ToastSuccess<T, E>(
            ok_message || "Operazione eseguita",
            result.data,
        );
    } else {
        if (err_message) {
            return new ToastFailure<T, E>(err_message, result.error);
        } else if (typeof result.error === "string") {
            return new ToastFailure<T, E>(result.error, result.error);
        } else if (
            result.error &&
            typeof result.error === "object" &&
            "message" in result.error &&
            typeof result.error.message === "string"
        ) {
            return new ToastFailure<T, E>(result.error.message, result.error);
        }
        return new ToastFailure<T, E>("Operazione fallita!", result.error);
    }
}

// ---------------------------------------------------------------------------
// Module-level factories.
// ---------------------------------------------------------------------------

export const ok = _ok;
export const err = _err;
export const fromObject = _fromObject;
export const fromResult = _fromResult;

// ---------------------------------------------------------------------------
// `Toast` namespace — declaration-merged with the `Toast<T, E>` type so
// existing `Toast.ok(...)`, `Toast.err(...)`, `Toast.fromObject(...)`,
// `Toast.fromResult(...)` and `import Toast from "..."` keep working.
// ---------------------------------------------------------------------------

export namespace Toast {
    export const ok = _ok;
    export const err = _err;
    export const fromObject = _fromObject;
    export const fromResult = _fromResult;
}

export default Toast;
