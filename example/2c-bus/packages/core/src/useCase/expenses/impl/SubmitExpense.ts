import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import type { ExecutionContext } from "@expenses/contract/useCase";
import type { ISubmitExpense } from "@expenses/contract/useCase/expenses/SubmitExpense";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import type IExpenseRepository from "../../../repo/IExpenseRepository.js";
import type IExpenseStatusChangeRepository from "../../../repo/IExpenseStatusChangeRepository.js";
import transitionExpense from "./transitionExpense.js";

@injectable()
export default class SubmitExpense implements ISubmitExpense {
    constructor(
        @inject(Port.UnitOfWork) private readonly uow: IUnitOfWork,
        @inject(Port.ExpenseRepository)
        private readonly expenses: IExpenseRepository,
        @inject(Port.ExpenseStatusChangeRepository)
        private readonly history: IExpenseStatusChangeRepository,
    ) {}

    async execute(input: ISubmitExpense.Input, context: ExecutionContext) {
        const result = await transitionExpense(
            { uow: this.uow, expenses: this.expenses, history: this.history },
            input.expense_id,
            "submitted",
            context,
        );
        return result.map((expense) => expense.toDTO());
    }
}
