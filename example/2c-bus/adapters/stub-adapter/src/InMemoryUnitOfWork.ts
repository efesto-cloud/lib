import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import { Result } from "better-result";
import type StubStore from "./StubStore.js";

/** Reentrant like the real one, and it really rolls back: from a snapshot. */
export default class InMemoryUnitOfWork implements IUnitOfWork {
    private depth = 0;

    constructor(private readonly store: StubStore) {}

    async runWithTransaction<A, E>(fn: () => Promise<Result<A, E>>) {
        if (this.depth > 0) return fn();
        const before = this.store.snapshot();
        this.depth++;
        try {
            const result = await fn();
            if (Result.isError(result)) this.store.restore(before);
            return result;
        } catch (error) {
            this.store.restore(before);
            throw error;
        } finally {
            this.depth--;
        }
    }
}
