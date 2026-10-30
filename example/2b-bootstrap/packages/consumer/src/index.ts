import type IUseCase from "@efesto-cloud/usecase";
import {
    type BootOptions,
    bootstrapConsumer,
    type Env,
} from "@expenses/bootstrap/consumer";
import { Result } from "effect";

/** Takes jobs from the queue and runs their use cases, the same ones the webapps call. */
export async function createConsumer(env: Env, options?: BootOptions) {
    const { resolveUseCase, jobs } = await bootstrapConsumer(env, options);
    return {
        async runPending() {
            let done = 0;
            for (let job = await jobs.next(); job; job = await jobs.next()) {
                const useCase = resolveUseCase(job.key) as IUseCase<
                    unknown,
                    Result.Result<unknown, { _tag: string }>
                >;
                const result = await useCase.execute(job.input, job.context);
                if (Result.isFailure(result))
                    console.warn(`[job] ${job.key}: ${result.failure._tag}`);
                done++;
            }
            return done;
        },
    };
}
