import { Result } from "@efesto-cloud/result";

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

export class Some<T extends NonNullable<unknown>> implements ISome<T> {
    readonly some = true as const;

    constructor(readonly data: T) {}

    isSome(): this is Some<T> {
        return true;
    }

    isNone(): this is None<T> {
        return false;
    }

    run(fn: (value: T) => void): void {
        fn(this.data);
    }

    map<R extends NonNullable<unknown>>(fn: (value: T) => R): Maybe<R> {
        return new Some<R>(fn(this.data));
    }

    flatMap<R extends NonNullable<unknown>>(
        fn: (value: T) => Maybe<R>,
    ): Maybe<R> {
        return fn(this.data);
    }

    fold<R1, R2>(_: () => R1, onSome: (value: T) => R2): R1 | R2 {
        return onSome(this.data);
    }

    filter(predicate: (value: T) => boolean): Maybe<T> {
        return predicate(this.data) ? new Some(this.data) : new None();
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

    toResult(): Result<T, NoneError> {
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

    run(): void {
        return;
    }

    map<R extends NonNullable<unknown>>(_: (value: T) => R): Maybe<R> {
        return new None<R>();
    }

    flatMap<R extends NonNullable<unknown>>(_: (_: T) => Maybe<R>): Maybe<R> {
        return new None<R>();
    }

    fold<R1, R2>(onNone: () => R1, _: (value: T) => R2): R1 | R2 {
        return onNone();
    }

    filter(): Maybe<T> {
        return new None();
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

    toResult(): Result<T, NoneError> {
        return Result.err(new NoneError());
    }
}

export type Maybe<T extends NonNullable<unknown>> = Some<T> | None<T>;

export namespace Maybe {
    export function maybe<T extends NonNullable<unknown>>(
        t?: T | null,
    ): Maybe<T> {
        return t !== null && t !== undefined ? new Some<T>(t) : new None<T>();
    }

    export function some<T extends NonNullable<unknown>>(t: T): Some<T> {
        return new Some<T>(t);
    }

    export function none<T extends NonNullable<unknown> = never>(): None<T> {
        return new None<T>();
    }

    export function fromObject<T extends NonNullable<unknown>>(
        obj: IMaybe<T>,
    ): Maybe<T> {
        return obj.some ? new Some(obj.data) : new None();
    }

    export function combine<
        T1 extends NonNullable<unknown>,
        T2 extends NonNullable<unknown>,
    >(m1: Maybe<T1>, m2: Maybe<T2>): Maybe<[T1, T2]> {
        return m1.isSome() && m2.isSome()
            ? new Some<[T1, T2]>([m1.data, m2.data])
            : new None();
    }
}
