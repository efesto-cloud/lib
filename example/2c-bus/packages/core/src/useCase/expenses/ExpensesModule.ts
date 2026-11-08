import type { UseCaseRegistry } from "@expenses/contract/registry";
import type { expenses } from "@expenses/contract/useCase/expenses/registry";
import { ContainerModule } from "inversify";
import ApproveExpense from "./impl/ApproveExpense.js";
import CreateExpense from "./impl/CreateExpense.js";
import ImportExpenses from "./impl/ImportExpenses.js";
import ListMyExpenses from "./impl/ListMyExpenses.js";
import ListSubmittedExpenses from "./impl/ListSubmittedExpenses.js";
import NotifyAuthor from "./impl/NotifyAuthor.js";
import ReimburseExpense from "./impl/ReimburseExpense.js";
import RejectExpense from "./impl/RejectExpense.js";
import SubmitExpense from "./impl/SubmitExpense.js";

/**
 * One implementation per use case of the module. A missing one, or one that
 * does not honour its interface in the contract, does not compile.
 */
const implementations: {
    [K in keyof typeof expenses]: new (
        // biome-ignore lint/suspicious/noExplicitAny: constructor arguments come from DI
        ...args: any[]
    ) => UseCaseRegistry[K];
} = {
    "expenses.CreateExpense": CreateExpense,
    "expenses.SubmitExpense": SubmitExpense,
    "expenses.ApproveExpense": ApproveExpense,
    "expenses.RejectExpense": RejectExpense,
    "expenses.ReimburseExpense": ReimburseExpense,
    "expenses.ListMyExpenses": ListMyExpenses,
    "expenses.ListSubmittedExpenses": ListSubmittedExpenses,
    "expenses.ImportExpenses": ImportExpenses,
    "expenses.NotifyAuthor": NotifyAuthor,
};

export const ExpensesModule = new ContainerModule(({ bind }) => {
    for (const [key, Implementation] of Object.entries(implementations)) {
        bind(key).to(Implementation);
    }
});
