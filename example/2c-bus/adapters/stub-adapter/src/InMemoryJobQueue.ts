import type { IExecutionContext } from "@efesto-cloud/usecase";
import type {
    IJobQueue,
    IJobSource,
    Job,
    UseCaseInput,
    UseCaseKey,
} from "@expenses/core";
import type StubStore from "./StubStore.js";

export default class InMemoryJobQueue implements IJobQueue, IJobSource {
    constructor(private readonly store: StubStore) {}

    async enqueue<K extends UseCaseKey>(
        key: K,
        input: UseCaseInput<K>,
        context: IExecutionContext,
    ) {
        this.store.state.jobs.push(
            structuredClone({ key, input, context }) as Job,
        );
    }

    async next() {
        return this.store.state.jobs.shift() ?? null;
    }
}
