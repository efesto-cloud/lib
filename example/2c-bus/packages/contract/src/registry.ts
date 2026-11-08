import { expenses } from "./useCase/expenses/registry.js";
import type { InputOf, UseCaseOf } from "./useCase.js";

/**
 * Every use case of the application, by key: what it can do. One line per
 * module; no module augmentation.
 */
export const useCases = { ...expenses };

export type UseCases = typeof useCases;
export type UseCaseKey = keyof UseCases;
export type UseCaseRegistry = { [K in UseCaseKey]: UseCaseOf<UseCases[K]> };
export type UseCaseInput<K extends UseCaseKey> = InputOf<UseCases[K]>;
export type ResolveUseCase = <K extends UseCaseKey>(
    key: K,
) => UseCaseRegistry[K];
