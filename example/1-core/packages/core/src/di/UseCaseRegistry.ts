import type IUseCase from "@efesto-cloud/usecase";

/**
 * Key → interface of every use case. Each module adds its own entries with
 * `declare module`. Outside this package the entries exist only if the module
 * file is imported, which is why server.ts imports every module.
 */
// biome-ignore lint/suspicious/noEmptyInterface: filled by declaration merging
export interface UseCaseRegistry {}

export type UseCaseKey = keyof UseCaseRegistry;

export type UseCaseInput<K extends UseCaseKey> =
    UseCaseRegistry[K] extends IUseCase<infer I, infer _R> ? I : never;

export type ResolveUseCase = <K extends UseCaseKey>(
    key: K,
) => UseCaseRegistry[K];
