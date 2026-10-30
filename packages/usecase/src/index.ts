import type { Result } from "effect";

// biome-ignore lint/suspicious/noEmptyInterface: we want to allow empty execution context -> libraries will extend this interface to add their own context properties
export interface IExecutionContext {}

type AnyResult = Result.Result<unknown, unknown>;

export type ExtractUseCaseInput<T extends IUseCase> =
    // biome-ignore lint/suspicious/noExplicitAny: we want to allow any input type
    T extends IUseCase<infer R, any> ? R : never;

export type ExtractUseCaseResponse<T extends IUseCase> =
    // biome-ignore lint/suspicious/noExplicitAny: we want to allow any response type
    T extends IUseCase<any, infer R> ? R : never;

/**
 * One business operation. It always answers with a `Result`: success or a
 * named error, never an exception the caller has to guess at.
 */
export default interface IUseCase<
    TInput = unknown,
    TResult extends AnyResult = AnyResult,
> {
    execute(input: TInput, context: IExecutionContext): Promise<TResult>;
}
