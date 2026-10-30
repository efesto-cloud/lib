// Bare imports: they bring the `declare module` augmentations into every
// importer's type graph. Without them UseCaseRegistry is empty outside the
// core and resolveUseCase returns never.
import "./executionContext.js";
import "./useCase/expenses/ExpensesModule.js";

export { Auth, AuthModule } from "./auth/AuthModule.js";
export type { default as IAuthorizer } from "./auth/IAuthorizer.js";
export type { default as IIdentifier } from "./auth/IIdentifier.js";
export * from "./client.js";
export { Database, implModule } from "./di/ImplModule.js";
export { Port } from "./di/Port.js";
export type {
    ResolveUseCase,
    UseCaseInput,
    UseCaseKey,
    UseCaseRegistry,
} from "./di/UseCaseRegistry.js";
export { ExpensesModule } from "./useCase/expenses/ExpensesModule.js";
