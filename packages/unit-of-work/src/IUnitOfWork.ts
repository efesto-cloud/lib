import type { Result } from "effect";

export default interface IUnitOfWork {
    /**
     * Runs `fn` inside a transaction. It commits when `fn` returns a success
     * and rolls back when it returns a failure or throws. A nested call joins
     * the outer transaction, so a use case can call another one.
     */
    runWithTransaction<A, E>(
        fn: () => Promise<Result.Result<A, E>>,
    ): Promise<Result.Result<A, E>>;
}
