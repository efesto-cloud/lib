export type ExtractUseCaseInput<T extends IUseCase> = T extends IUseCase<infer R, any>
  ? R
  : never;

export type ExtractUseCaseResponse<T extends IUseCase> = T extends IUseCase<any, infer R>
  ? R
  : never;

export default interface IUseCase<TRequest = unknown, TResponse = unknown> {
  readonly name: string;
  execute(input: TRequest): Promise<TResponse>;
}
