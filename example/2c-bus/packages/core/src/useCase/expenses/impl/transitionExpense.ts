import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import ExpenseNotFound from "@expenses/contract/errors/ExpenseNotFound";
import type InvalidTransition from "@expenses/contract/errors/InvalidTransition";
import type { ExpenseStatus } from "@expenses/contract/type/ExpenseStatus";
import type { ExecutionContext } from "@expenses/contract/useCase";
import { Result } from "better-result";
import type Expense from "../../../entity/Expense.js";
import type IExpenseRepository from "../../../repo/IExpenseRepository.js";
import type IExpenseStatusChangeRepository from "../../../repo/IExpenseStatusChangeRepository.js";

/** Load → mutate → save, with the history row in the same transaction. */
export default function transitionExpense(
    deps: {
        uow: IUnitOfWork;
        expenses: IExpenseRepository;
        history: IExpenseStatusChangeRepository;
    },
    expense_id: string,
    to: ExpenseStatus,
    context: ExecutionContext,
): Promise<Result<Expense, ExpenseNotFound | InvalidTransition>> {
    return deps.uow.runWithTransaction<
        Expense,
        ExpenseNotFound | InvalidTransition
    >(async () => {
        const expense = await deps.expenses.findById(expense_id);
        if (!expense) return Result.err(new ExpenseNotFound({ expense_id }));

        const change = expense.transition(to, context.actor.id);
        if (Result.isError(change)) return Result.err(change.error);

        await deps.expenses.save(expense);
        await deps.history.add(change.value);
        return Result.ok(expense);
    });
}
