export type ExtractUseCaseInput<T extends IUseCase> =
    // biome-ignore lint/suspicious/noExplicitAny: we want to allow any input type
    T extends IUseCase<infer R, any> ? R : never;

export type ExtractUseCaseResponse<T extends IUseCase> =
    // biome-ignore lint/suspicious/noExplicitAny: we want to allow any response type
    T extends IUseCase<any, infer R> ? R : never;

export default interface IUseCase<TRequest = unknown, TResponse = unknown> {
    readonly name: string;
    execute(input: TRequest): Promise<TResponse>;
}
