import type { Result } from "better-result";

type AnyResult = Result<unknown, unknown>;

export type ExtractUseCaseInput<T extends IUseCase> =
    // biome-ignore lint/suspicious/noExplicitAny: we want to allow any input type
    T extends IUseCase<infer R, any, any> ? R : never;

export type ExtractUseCaseResponse<T extends IUseCase> =
    // biome-ignore lint/suspicious/noExplicitAny: we want to allow any response type
    T extends IUseCase<any, infer R, any> ? R : never;

/**
 * One business operation. It always answers with a `Result`: success or a
 * named error, never an exception the caller has to guess at.
 *
 * `TContext` is what every call carries besides the input (who acts, for
 * instance). The application declares it once, usually as an alias:
 * `type UseCase<I, R> = IUseCase<I, R, ExecutionContext>`.
 */
export default interface IUseCase<
    TInput = unknown,
    TResult extends AnyResult = AnyResult,
    TContext = unknown,
> {
    execute(input: TInput, context: TContext): Promise<TResult>;
}
