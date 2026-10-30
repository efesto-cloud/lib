import { ContainerModule } from "inversify";
import type IApproveExpense from "./IApproveExpense.js";
import type ICreateExpense from "./ICreateExpense.js";
import type IImportExpenses from "./IImportExpenses.js";
import type IListMyExpenses from "./IListMyExpenses.js";
import type IListSubmittedExpenses from "./IListSubmittedExpenses.js";
import type INotifyAuthor from "./INotifyAuthor.js";
import type IReimburseExpense from "./IReimburseExpense.js";
import type IRejectExpense from "./IRejectExpense.js";
import type ISubmitExpense from "./ISubmitExpense.js";
import ApproveExpense from "./impl/ApproveExpense.js";
import CreateExpense from "./impl/CreateExpense.js";
import ImportExpenses from "./impl/ImportExpenses.js";
import ListMyExpenses from "./impl/ListMyExpenses.js";
import ListSubmittedExpenses from "./impl/ListSubmittedExpenses.js";
import NotifyAuthor from "./impl/NotifyAuthor.js";
import ReimburseExpense from "./impl/ReimburseExpense.js";
import RejectExpense from "./impl/RejectExpense.js";
import SubmitExpense from "./impl/SubmitExpense.js";

declare module "../../di/UseCaseRegistry.js" {
    interface UseCaseRegistry {
        "expenses.CreateExpense": ICreateExpense;
        "expenses.SubmitExpense": ISubmitExpense;
        "expenses.ApproveExpense": IApproveExpense;
        "expenses.RejectExpense": IRejectExpense;
        "expenses.ReimburseExpense": IReimburseExpense;
        "expenses.ListMyExpenses": IListMyExpenses;
        "expenses.ListSubmittedExpenses": IListSubmittedExpenses;
        "expenses.ImportExpenses": IImportExpenses;
        "expenses.NotifyAuthor": INotifyAuthor;
    }
}

export const ExpensesModule = new ContainerModule(({ bind }) => {
    bind("expenses.CreateExpense").to(CreateExpense);
    bind("expenses.SubmitExpense").to(SubmitExpense);
    bind("expenses.ApproveExpense").to(ApproveExpense);
    bind("expenses.RejectExpense").to(RejectExpense);
    bind("expenses.ReimburseExpense").to(ReimburseExpense);
    bind("expenses.ListMyExpenses").to(ListMyExpenses);
    bind("expenses.ListSubmittedExpenses").to(ListSubmittedExpenses);
    bind("expenses.ImportExpenses").to(ImportExpenses);
    bind("expenses.NotifyAuthor").to(NotifyAuthor);
});
