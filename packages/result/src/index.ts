import type { ZodError, ZodSafeParseResult } from "zod";

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

export class Success<T, E = never> implements ISuccess<T, E> {
    readonly success = true;
    readonly error = undefined;

    constructor(readonly data: T) {}

    isSuccess(): this is Success<T, E> {
        return true;
    }

    isFailure(): this is Failure<E, T> {
        return false;
    }

    unwrapOrThrow(): T {
        return this.data;
    }

    run(fn: (data: T) => void): void {
        fn(this.data);
    }

    mapError<E2>(_: (_: E) => E2): Result<T, E2> {
        return new Success<T>(this.data);
    }

    map<R, E2>(fn: (data: T) => R): Result<R, E | E2> {
        return new Success<R>(fn(this.data));
    }

    flatMap<R, E2>(fn: (data: T) => Result<R, E2>): Result<R, E | E2> {
        return fn(this.data);
    }

    fold<R1, R2>(_: (error: E) => R1, onSuccess: (data: T) => R2): R1 | R2 {
        return onSuccess(this.data);
    }

    else(): Result<T, E> {
        return this;
    }

    toObject(): ISuccess<T> {
        return {
            success: true,
            data: this.data,
            error: undefined,
        };
    }
}

export class Failure<E, T = never> implements IFailure<E> {
    readonly success = false;
    readonly data = undefined;

    constructor(readonly error: E) {}

    isSuccess(): this is Success<T, E> {
        return false;
    }

    isFailure(): this is Failure<E, T> {
        return true;
    }

    unwrapOrThrow(): never {
        throw this.error;
    }

    run(): void {
        return;
    }

    mapError<E2>(fn: (error: E) => E2): Result<T, E2> {
        return new Failure<E2, T>(fn(this.error));
    }

    map<R, E2>(_: (_: T) => R): Result<R, E | E2> {
        return new Failure<E | E2>(this.error);
    }

    flatMap<R, E2>(_: (_: T) => Result<R, E2>): Result<R, E | E2> {
        return new Failure<E | E2>(this.error);
    }

    fold<R1, R2>(onFailure: (error: E) => R1, _: (_: T) => R2): R1 | R2 {
        return onFailure(this.error);
    }

    else(value: () => T): Result<T, E> {
        return new Success<T>(value());
    }

    toObject(): IFailure<E> {
        return {
            success: false,
            data: undefined,
            error: this.error,
        };
    }
}

type Result<T, E> = Success<T, E> | Failure<E, T>;

namespace Result {
    export function ok(): Success<void>;
    export function ok<T>(v: T): Success<T>;
    export function ok<T = void>(v?: T): Success<T> {
        return new Success<T>(v as T);
    }

    export function err(): Failure<void>;
    export function err<E>(v: E): Failure<E>;
    export function err<E = void>(v?: E): Failure<E> {
        return new Failure<E>(v as E);
    }

    export function fromObject<T, E>(obj: IResult<T, E>): Result<T, E> {
        return obj.success
            ? new Success<T>(obj.data)
            : new Failure<E>(obj.error);
    }

    export function fromZod<Output>(
        res: ZodSafeParseResult<Output>,
    ): Result<Output, ZodError<Output>> {
        if (res.success) {
            return Result.ok(res.data);
        }

        return Result.err(res.error);
    }
}

export default Result;
