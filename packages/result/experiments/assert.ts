// Type-level equality assertion helpers.
// `Expect<true>` compiles fine; `Expect<false>` is a type error.

export type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false;

export type Expect<T extends true> = T;

export type Assignable<From, To> = [From] extends [To] ? true : false;
export type Bidirectional<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? true
        : false
    : false;
