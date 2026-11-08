import type { UseCaseInput, UseCaseKey } from "@expenses/contract/registry";
import type { ExecutionContext } from "@expenses/contract/useCase";

/** A use case to run later, by a consumer, with the context of who asked. */
export type Job = {
    [K in UseCaseKey]: {
        key: K;
        input: UseCaseInput<K>;
        context: ExecutionContext;
    };
}[UseCaseKey];

/** Deferred work. Typed on the registry: a wrong key or input does not compile. */
export default interface IJobQueue {
    enqueue<K extends UseCaseKey>(
        key: K,
        input: UseCaseInput<K>,
        context: ExecutionContext,
    ): Promise<void>;
}

/** The consumer's side of the queue. */
export interface IJobSource {
    next(): Promise<Job | null>;
}
