import type { UseCaseInput, UseCaseKey } from "@expenses/contract/registry";
import type { ExecutionContext } from "@expenses/contract/useCase";
import type IJobQueue from "@expenses/core/service/IJobQueue";
import type { IJobSource, Job } from "@expenses/core/service/IJobQueue";
import type StubStore from "./StubStore.js";

export default class InMemoryJobQueue implements IJobQueue, IJobSource {
    constructor(private readonly store: StubStore) {}

    async enqueue<K extends UseCaseKey>(
        key: K,
        input: UseCaseInput<K>,
        context: ExecutionContext,
    ) {
        this.store.state.jobs.push(
            structuredClone({ key, input, context }) as Job,
        );
    }

    async next() {
        return this.store.state.jobs.shift() ?? null;
    }
}
