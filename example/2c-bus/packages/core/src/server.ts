// Bare imports: they bring the `declare module` augmentations into every
// importer's type graph. Without them UseCaseRegistry is empty outside the
// core and resolveUseCase returns never.
import "./executionContext.js";
import "./useCase/expenses/ExpensesModule.js";

export { Auth, AuthModule } from "./auth/AuthModule.js";
export type { default as IAuthorizer } from "./auth/IAuthorizer.js";
export type { default as IIdentifier } from "./auth/IIdentifier.js";
export { policies } from "./auth/policies.js";
export * from "./client.js";
export { Port } from "./di/Port.js";
export type {
    ResolveUseCase,
    UseCaseInput,
    UseCaseKey,
    UseCaseRegistry,
} from "./di/UseCaseRegistry.js";
export { default as Expense } from "./entity/Expense.js";
export type { default as ExpenseStatusChange } from "./entity/ExpenseStatusChange.js";
export type { default as IExpenseRepository } from "./repo/IExpenseRepository.js";
export type { default as IExpenseStatusChangeRepository } from "./repo/IExpenseStatusChangeRepository.js";
export type { default as IMemberRepository } from "./repo/IMemberRepository.js";
export type {
    default as IExpenseFileReader,
    ExpenseRow,
} from "./service/IExpenseFileReader.js";
export type {
    default as IJobQueue,
    IJobSource,
    Job,
} from "./service/IJobQueue.js";
export type { default as IMailer } from "./service/IMailer.js";
export { ExpensesModule } from "./useCase/expenses/ExpensesModule.js";
export { default as Amount } from "./value_object/Amount.js";
