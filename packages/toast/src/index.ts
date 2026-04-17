import Maybe from "@efesto-cloud/maybe";
import type { IResult } from "@efesto-cloud/result";

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

export class ToastSuccess<T, E = never> implements IToastSuccess<T, E> {
    readonly success = true;
    readonly error = undefined;

    constructor(
        readonly message: string,
        readonly data: T,
    ) {}

    isSuccess(): this is ToastSuccess<T, E> {
        return true;
    }

    isFailure(): this is ToastFailure<E, T> {
        return false;
    }

    unwrapOrThrow(): T {
        return this.data;
    }

    run(fn: (data: T) => void): void {
        fn(this.data);
    }

    map<R, E2>(fn: (data: T) => R): Toast<R, E | E2> {
        return new ToastSuccess<R>(this.message, fn(this.data));
    }

    flatMap<R, E2>(fn: (data: T) => Toast<R, E2>): Toast<R, E | E2> {
        return fn(this.data);
    }

    fold<R1, R2>(_: (error: E) => R1, onSuccess: (data: T) => R2): R1 | R2 {
        return onSuccess(this.data);
    }

    else(): Toast<T, E> {
        return this;
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

export class ToastFailure<E, T = never> implements IToastFailure<E> {
    readonly success = false;
    readonly data = undefined;

    constructor(
        readonly message: string,
        readonly error: E,
    ) {}

    isSuccess(): this is ToastSuccess<T, E> {
        return false;
    }

    isFailure(): this is ToastFailure<E, T> {
        return true;
    }

    unwrapOrThrow(): never {
        throw this.error;
    }

    run(): void {
        return;
    }

    map<R, E2>(_: (_: T) => R): Toast<R, E | E2> {
        return new ToastFailure<E | E2>(this.message, this.error);
    }

    flatMap<R, E2>(_: (_: T) => Toast<R, E2>): Toast<R, E | E2> {
        return new ToastFailure<E | E2>(this.message, this.error);
    }

    fold<R1, R2>(onFailure: (error: E) => R1, _: (_: T) => R2): R1 | R2 {
        return onFailure(this.error);
    }

    else(value: () => T): Toast<T, E> {
        return new ToastSuccess<T>(this.message, value());
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

type Toast<T, E> = ToastSuccess<T, E> | ToastFailure<E, T>;

namespace Toast {
    export function ok(message: string): ToastSuccess<void>;
    export function ok<T>(message: string, v: T): ToastSuccess<T>;
    export function ok<T = void>(message: string, v?: T): ToastSuccess<T> {
        return new ToastSuccess<T>(message, v as T);
    }

    export function err(message: string): ToastFailure<void>;
    export function err<E>(message: string, v: E): ToastFailure<E>;
    export function err<E = void>(message: string, v?: E): ToastFailure<E> {
        return new ToastFailure<E>(message, v as E);
    }

    export function fromObject<T, E>(obj: IToast<T, E>): Toast<T, E> {
        return obj.success
            ? new ToastSuccess<T>(obj.message, obj.data)
            : new ToastFailure<E>(obj.message, obj.error);
    }

    export function fromResult<T, E>(result: IResult<T, E>): Toast<T, E>;
    export function fromResult<T, E>(
        result: IResult<T, E>,
        ok_message: string,
    ): Toast<T, E>;
    export function fromResult<T, E>(
        result: IResult<T, E>,
        ok_message: string,
        err_message: string,
    ): Toast<T, E>;
    export function fromResult<T, E>(
        result: IResult<T, E>,
        ok_message?: string,
        err_message?: string,
    ): Toast<T, E> {
        if (result.success) {
            return new ToastSuccess<T>(
                ok_message || "Operazione eseguita",
                result.data,
            );
        } else {
            if (err_message) {
                return new ToastFailure<E>(err_message, result.error);
            } else if (typeof result.error === "string") {
                return new ToastFailure<E>(result.error, result.error);
            } else if (
                result.error &&
                typeof result.error === "object" &&
                "message" in result.error &&
                typeof result.error.message === "string"
            ) {
                return new ToastFailure<E>(result.error.message, result.error);
            }
            return new ToastFailure<E>("Operazione fallita!", result.error);
        }
    }
}

export default Toast;
